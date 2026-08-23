import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AuthBackground, Button, Screen, Text } from '../../components';
import { colors, radius, shadow, spacing, typography, useStyles, type Colors } from '../../theme';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList } from '../../navigation/types';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

/**
 * When each number last had a code sent to it.
 *
 * Module scope, not component state: leaving the screen and coming back
 * remounts it, and a fresh 60-second countdown per mount let someone burn the
 * server's five-per-fifteen-minutes budget in under a minute and then sit in
 * front of a rate-limit error with no idea why.
 */
const lastSentAt = new Map<string, number>();

const cooldownFor = (phone: string): number => {
  const sent = lastSentAt.get(phone);
  if (sent === undefined) return RESEND_SECONDS;
  return Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - sent) / 1000));
};

/**
 * ui.md §9 — six-digit verification.
 *
 * A single hidden TextInput backs the six boxes. Six separate inputs fight the
 * keyboard, break paste, and make autofill from an SMS unreliable.
 */
export const OtpScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AuthStackParamList, 'Otp'>>();
  const { phone, debugCode } = route.params;

  const signIn = useAuthStore((state) => state.signIn);
  const inputRef = useRef<TextInput>(null);

  /**
   * Prefilled in development so the flow can be walked without an SMS.
   *
   * Gated on `__DEV__` rather than on the field being present. A server that is
   * misconfigured to return `debugCode` in production would otherwise hand every
   * caller a working code and type it in for them — which both hides the fact
   * that no SMS is being sent, and lets anyone sign in as anyone. The client
   * refusing to use it is the half of that we control.
   */
  const [code, setCode] = useState(__DEV__ ? (debugCode ?? '') : '');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  /** Set once the server refuses further codes; no countdown will clear it. */
  const [rateLimited, setRateLimited] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(() => {
    // Arriving from the phone screen means a code was just sent.
    if (!lastSentAt.has(phone)) lastSentAt.set(phone, Date.now());
    return cooldownFor(phone);
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // The confirmation is reassurance, not a state the screen should stay in.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || loading) return;
    setError(undefined);
    setNotice(undefined);
    setLoading(true);

    try {
      const session = await authApi.verifyOtp(phone, value);
      // The root navigator swaps to the app stack off the back of this.
      await signIn(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Please try again.');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (secondsLeft > 0 || resending || rateLimited) return;
    setError(undefined);
    setNotice(undefined);
    setResending(true);

    try {
      const result = await authApi.requestOtp(phone);
      lastSentAt.set(phone, Date.now());
      setSecondsLeft(RESEND_SECONDS);
      setCode('');
      // Without this, a successful resend looks identical to a dead button.
      setNotice('A new code is on its way.');
      if (__DEV__ && result.debugCode) setCode(result.debugCode);
      inputRef.current?.focus();
    } catch (err) {
      /**
       * Two different refusals come back from this endpoint, and they need
       * different answers.
       *
       * OTP_COOLDOWN is the per-number wait, and it is authoritative: the local
       * countdown can drift while the app is backgrounded, so the server's
       * remaining seconds replace it rather than the customer being told off.
       *
       * OTP_RATE_LIMITED is the five-per-fifteen-minutes ceiling. No countdown
       * will clear it, so the button goes away instead of inviting more taps.
       */
      if (err instanceof ApiError && err.code === 'OTP_COOLDOWN') {
        const wait = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
        setSecondsLeft(wait && wait > 0 ? wait : RESEND_SECONDS);
        lastSentAt.set(phone, Date.now() - (RESEND_SECONDS - (wait ?? RESEND_SECONDS)) * 1000);
      } else if (err instanceof ApiError && err.code === 'OTP_RATE_LIMITED') {
        setRateLimited(true);
      }
      setError(err instanceof ApiError ? err.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthBackground>
      <Screen
        background="transparent"
        footerStyle={styles.footer}
        footer={
          <Button
            label="Verify"
            onPress={() => verify(code)}
            loading={loading}
            disabled={code.length !== OTP_LENGTH}
          />
        }
      >
        <View style={styles.body}>
          <Text variant="h1">Verify your number</Text>
          <Text tone="secondary" style={styles.subtitle}>
            Enter the {OTP_LENGTH}-digit code sent to +234 {phone.replace(/^0/, '')}
          </Text>

          <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const char = code[index];
              const isCursor = index === code.length;
              return (
                <View
                  key={index}
                  style={[styles.box, char && styles.boxFilled, isCursor && styles.boxActive, error && styles.boxError]}
                >
                  <Text style={styles.digit}>{char ?? ''}</Text>
                </View>
              );
            })}
          </Pressable>

          {/* Off-screen but focusable: it owns the keyboard and SMS autofill. */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(value) => {
              const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
              setCode(digits);
              setError(undefined);
              if (digits.length === OTP_LENGTH) void verify(digits);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
          />

          {error ? (
            <Text tone="danger" center style={styles.message}>
              {error}
            </Text>
          ) : notice ? (
            <Text tone="success" center style={styles.message}>
              {notice}
            </Text>
          ) : null}

          <View style={styles.resendRow}>
            {rateLimited ? (
              <Text variant="caption" tone="muted" center>
                You have requested several codes. Please wait a few minutes before asking for
                another.
              </Text>
            ) : secondsLeft > 0 ? (
              <Text tone="muted" center>
                Resend code in {secondsLeft}s
              </Text>
            ) : (
              <Pressable
                onPress={resend}
                disabled={resending}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Resend code"
                accessibilityState={{ disabled: resending, busy: resending }}
                style={({ pressed }) => [styles.resendButton, pressed && styles.resendPressed]}
              >
                <Text tone="brand" variant="bodyMedium" center>
                  {resending ? 'Sending…' : 'Resend code'}
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.change}>
            <Text tone="secondary" center>
              Wrong number? Change it
            </Text>
          </Pressable>
        </View>
      </Screen>
    </AuthBackground>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  body: { flexGrow: 1, paddingTop: spacing.xxl },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xxl },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  boxFilled: { borderColor: c.borderStrong },
  boxActive: { borderColor: c.brand },
  boxError: { borderColor: c.danger },
  digit: { ...typography.h2, color: c.text },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  message: { marginTop: spacing.base },

  resendRow: { marginTop: spacing.xl, alignItems: 'center' },
  /** A real target rather than a line of text — it is the screen's escape route. */
  resendButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: c.brandSubtle,
  },
  resendPressed: { backgroundColor: c.brandBorder },

  change: { marginTop: spacing.lg },
  footer: { backgroundColor: 'transparent', borderTopWidth: 0 },
});
