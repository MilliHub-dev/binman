import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, AuthBackground, Button, Screen, Text } from '../../components';
import { radius, shadow, spacing, typography, useLayout, useStyles, type Colors, useTheme } from '../../theme';
import { formatPhoneInput } from '../../utils/format';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/types';

/**
 * ui.md §8 — "What's your phone number?"
 *
 * The screen carries the brand through an ambient wash rather than a header, so
 * the number stays the only thing competing for attention. It is also the
 * largest thing in the body: at body size the field read as a label rather than
 * as the one piece of content on the screen.
 */
export const PhoneScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { isSmall } = useLayout();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const digits = phone.replace(/\D/g, '');
  // Nigerian mobile numbers are 11 digits with the trunk 0, 10 without.
  const isValid = digits.length === 10 || digits.length === 11;

  const submit = async () => {
    if (!isValid || loading) return;
    setError(undefined);
    setLoading(true);

    try {
      const result = await authApi.requestOtp(digits);
      navigation.navigate('Otp', {
        phone: digits,
        isNewUser: result.isNewUser,
        // Development convenience; the server omits it in production.
        ...(result.debugCode ? { debugCode: result.debugCode } : {}),
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'We could not send your code. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <Screen
        // Transparent so the wash shows through the whole screen, safe area
        // included, rather than stopping at a painted band.
        background="transparent"
        // The wash runs to the bottom edge; an opaque footer bar would slice it.
        footerStyle={styles.footer}
        footer={
          <View>
            {/*
              Tappable, because this is where the agreement is actually made.
              Naming documents nobody can open is the worst of both worlds.
            */}
            <Text variant="caption" tone="muted" center style={styles.terms}>
              By continuing you agree to our{' '}
              <Text variant="caption" tone="brand" onPress={() => navigation.navigate('Terms')}>
                Terms &amp; Conditions
              </Text>{' '}
              and{' '}
              <Text variant="caption" tone="brand" onPress={() => navigation.navigate('Privacy')}>
                Privacy Policy
              </Text>
              .
            </Text>
            <Button label="Continue" onPress={submit} loading={loading} disabled={!isValid} />
          </View>
        }
      >
        <View style={[styles.body, { paddingTop: isSmall ? spacing.xl : spacing.huge }]}>
          <Text variant="h1">What's your phone number?</Text>
          <Text tone="secondary" style={styles.subtitle}>
            We'll text you a code to sign in. No password to remember.
          </Text>

          {/*
            Built here rather than with the shared Input: the divided country
            segment and the oversized digits are specific to this one field, and
            bending the general component into this shape would leave every
            other form carrying the props.
          */}
          <View
            style={[
              styles.field,
              focused && styles.fieldFocused,
              // A problem outranks focus — the red must not be overridden.
              Boolean(error) && styles.fieldError,
            ]}
          >
            <View style={styles.country}>
              <Text style={styles.flag}>🇳🇬</Text>
              <Text style={styles.dialCode}>+234</Text>
            </View>
            <View style={styles.divider} />

            <TextInput
              value={phone}
              onChangeText={(value) => {
                setPhone(formatPhoneInput(value));
                setError(undefined);
              }}
              style={styles.input}
              placeholder="801 234 5678"
              placeholderTextColor={colors.textDisabled}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              autoFocus
              maxLength={13}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={submit}
              returnKeyType="done"
              accessibilityLabel="Phone number"
              selectionColor={colors.brand}
            />

            {/* Confirms the number is complete without waiting for a tap. */}
            {isValid && !error ? (
              <View style={styles.check}>
                <Icon name="check" size={13} color={colors.textInverse} strokeWidth={3} />
              </View>
            ) : null}
          </View>

          {error ? (
            <Text variant="caption" tone="danger" style={styles.error}>
              {error}
            </Text>
          ) : (
            <View style={styles.reassurance}>
              <Icon name="lock" size={13} color={colors.textMuted} />
              <Text variant="caption" tone="muted" style={styles.reassuranceText}>
                We only use your number to reach you about pickups. It is never shared.
              </Text>
            </View>
          )}
        </View>
      </Screen>
    </AuthBackground>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  body: { flexGrow: 1 },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xl },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    // Stays solid on every state so the field lifts off the wash behind it.
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.lg,
    paddingLeft: spacing.base,
    paddingRight: spacing.md,
    minHeight: 64,
    ...shadow.sm,
  },
  fieldFocused: { borderColor: c.brand, ...shadow.md },
  fieldError: { borderColor: c.danger },

  country: { flexDirection: 'row', alignItems: 'center' },
  flag: { fontSize: 20 },
  dialCode: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: c.text,
    marginLeft: spacing.sm,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: c.borderStrong,
    marginHorizontal: spacing.md,
  },

  input: {
    flex: 1,
    ...typography.h3,
    fontSize: 20,
    letterSpacing: 1,
    /**
     * Tabular figures rather than a monospaced face: the digits keep an even
     * rhythm and the groups stop nudging sideways as they fill, without pulling
     * a second typeface into a UI that is otherwise all system font.
     */
    fontVariant: ['tabular-nums'],
    color: c.text,
    paddingVertical: spacing.md,
  },

  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: c.textInverse, fontSize: 13, fontWeight: '700', lineHeight: 16 },

  error: { marginTop: spacing.md },
  reassurance: { flexDirection: 'row', marginTop: spacing.base, paddingRight: spacing.sm },
  lock: { fontSize: 13, marginRight: spacing.sm, marginTop: 1 },
  reassuranceText: { flex: 1 },

  terms: { marginBottom: spacing.md },
  footer: { backgroundColor: 'transparent', borderTopWidth: 0 },
});
