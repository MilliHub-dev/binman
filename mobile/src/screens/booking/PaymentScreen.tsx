import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '../../components';
import { spacing, useStyles, type Colors, useTheme } from '../../theme';
import { checkPayment, initiatePayment } from '../../api/endpoints';
import { useBooking } from '../../api/queries';
import { useBookingDraft } from '../../store/bookingDraft';
import { ApiError } from '../../api/client';
import { formatNaira } from '../../utils/format';
import type { BookingStackParamList } from '../../navigation/types';

type Phase = 'idle' | 'opening' | 'verifying' | 'failed';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

/**
 * Payment (ui.md §19–20).
 *
 * Flutterwave's hosted checkout runs in a system browser, so the app never
 * touches card details. When the customer comes back we do NOT trust anything
 * the browser tells us — the server is polled, and it re-verifies against
 * Flutterwave before confirming (trsa.md §9).
 */
export const PaymentScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<BookingStackParamList>>();
  const { bookingId } = useRoute<RouteProp<BookingStackParamList, 'Payment'>>().params;

  const booking = useBooking(bookingId);
  const resetDraft = useBookingDraft((state) => state.reset);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string>();
  const pollsRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(
    () => () => {
      // Stops the poll loop if the screen unmounts mid-verification.
      cancelledRef.current = true;
    },
    [],
  );

  const pollUntilPaid = async (reference: string): Promise<void> => {
    pollsRef.current = 0;

    while (pollsRef.current < MAX_POLLS && !cancelledRef.current) {
      pollsRef.current += 1;

      try {
        const result = await checkPayment(reference);

        if (result.status === 'SUCCESSFUL') {
          resetDraft();
          navigation.replace('Confirmation', { bookingId });
          return;
        }

        if (result.status === 'FAILED' || result.status === 'CANCELLED') {
          setPhase('failed');
          setError('Your payment did not go through. No money has been taken.');
          return;
        }
      } catch {
        // A transient network error during polling is not a payment failure;
        // keep waiting rather than telling the customer it failed.
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!cancelledRef.current) {
      setPhase('failed');
      setError(
        "We haven't received confirmation yet. If money left your account, your booking will update shortly — check My Bookings.",
      );
    }
  };

  const pay = async () => {
    setError(undefined);
    setPhase('opening');

    try {
      const payment = await initiatePayment(bookingId);

      // Blocks until the browser is dismissed or the redirect fires.
      await WebBrowser.openBrowserAsync(payment.checkoutUrl, {
        dismissButtonStyle: 'cancel',
        toolbarColor: colors.surface,
        controlsColor: colors.brand,
      });

      setPhase('verifying');
      await pollUntilPaid(payment.reference);
    } catch (err) {
      setPhase('failed');
      setError(
        err instanceof ApiError ? err.message : 'We could not start your payment. Please try again.',
      );
    }
  };

  if (booking.isLoading) return <Screen><LoadingState /></Screen>;
  if (booking.error) return <Screen><ErrorState error={booking.error} onRetry={booking.refetch} /></Screen>;

  const total = booking.data?.pricing.total ?? 0;

  if (phase === 'verifying') {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text variant="h3" center style={styles.processingTitle}>
            Confirming your payment…
          </Text>
          <Text tone="secondary" center>
            Please don't close the app. This usually takes a few seconds.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={`Pay ${formatNaira(total)}`}
          onPress={pay}
          loading={phase === 'opening'}
        />
      }
    >
      <Text variant="h1" style={styles.title}>
        Choose payment method
      </Text>

      <Card selected>
        <View style={styles.method}>
          <Text style={styles.methodEmoji}>💳</Text>
          <View style={styles.methodBody}>
            <Text variant="bodyMedium">Card, transfer or USSD</Text>
            <Text variant="caption" tone="secondary">
              Secured by Flutterwave
            </Text>
          </View>
        </View>
      </Card>

      <Text variant="caption" tone="muted" style={styles.note}>
        You'll be taken to Flutterwave's secure checkout to complete payment. BinMan never sees
        your card details.
      </Text>

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text tone="secondary">Booking</Text>
          <Text>{booking.data?.reference}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text variant="h3">Total</Text>
          <Text variant="h3">{formatNaira(total)}</Text>
        </View>
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <Text tone="danger">{error}</Text>
          <Button
            label="View My Bookings"
            variant="ghost"
            onPress={() => navigation.getParent()?.goBack()}
            style={styles.errorAction}
          />
        </Card>
      ) : null}
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  title: { marginTop: spacing.base, marginBottom: spacing.lg },
  method: { flexDirection: 'row', alignItems: 'center' },
  methodEmoji: { fontSize: 26, marginRight: spacing.md },
  methodBody: { flex: 1 },
  note: { marginTop: spacing.md },
  summary: { marginTop: spacing.xl },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  errorCard: { marginTop: spacing.lg, borderColor: c.danger },
  errorAction: { marginTop: spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  processingTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
