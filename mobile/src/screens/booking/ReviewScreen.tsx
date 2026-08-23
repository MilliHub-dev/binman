import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PriceSummary,
  Screen,
  StepHeader,
  Text,
} from '../../components';
import { colors, spacing, useStyles, type Colors } from '../../theme';
import { formatLongDate, humanise } from '../../utils/format';
import { getQuote } from '../../api/endpoints';
import { useCreateBooking } from '../../api/queries';
import { useBookingDraft, isDraftComplete } from '../../store/bookingDraft';
import { ApiError } from '../../api/client';
import type { BookingStackParamList } from '../../navigation/types';

/**
 * Step 5 (ui.md §18) — confirm what was chosen, then the price.
 *
 * The price is fetched fresh here rather than carried forward: it is the number
 * the customer is about to agree to, and it must come from the server
 * (prd.md §12).
 */
export const ReviewScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<BookingStackParamList>>();
  const draft = useBookingDraft();
  const createBooking = useCreateBooking();

  const isWaste = draft.serviceType === 'WASTE_COLLECTION';

  const quoteInput = {
    serviceType: draft.serviceType,
    ...(isWaste
      ? { wasteTypes: draft.wasteTypes, collectionSize: draft.collectionSize ?? undefined }
      : {
          cleaningType: draft.cleaningType ?? undefined,
          propertySize: draft.propertySize ?? undefined,
        }),
    addressId: draft.address?.id,
  };

  const quote = useQuery({
    queryKey: ['quote', quoteInput],
    queryFn: () => getQuote(quoteInput),
    enabled: isDraftComplete(draft),
  });

  const submit = async () => {
    if (!isDraftComplete(draft)) return;

    const booking = await createBooking.mutateAsync({
      serviceType: draft.serviceType,
      addressId: draft.address!.id,
      scheduledDate: draft.scheduledDate!,
      timeSlotId: draft.timeSlotId!,
      ...(draft.notes ? { notes: draft.notes } : {}),
      ...(isWaste
        ? { wasteTypes: draft.wasteTypes, collectionSize: draft.collectionSize! }
        : {
            cleaningType: draft.cleaningType!,
            propertyType: draft.propertyType!,
            propertySize: draft.propertySize!,
            ...(draft.numberOfRooms ? { numberOfRooms: draft.numberOfRooms } : {}),
          }),
    });

    navigation.navigate('Payment', { bookingId: booking.id });
  };

  if (quote.isLoading) return <Screen><LoadingState label="Calculating your price…" /></Screen>;
  if (quote.error) return <Screen><ErrorState error={quote.error} onRetry={quote.refetch} /></Screen>;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Service', value: isWaste ? 'Waste Collection' : 'Cleaning' },
    {
      label: 'Address',
      value: `${draft.address?.addressLine ?? ''}, ${draft.address?.area ?? ''}`,
    },
    ...(isWaste
      ? [
          { label: 'Waste', value: draft.wasteTypes.map(humanise).join(', ') },
          { label: 'Size', value: humanise(draft.collectionSize ?? '') },
        ]
      : [
          { label: 'Cleaning', value: humanise(draft.cleaningType ?? '') },
          { label: 'Property', value: humanise(draft.propertySize ?? '') },
        ]),
    { label: 'Date', value: draft.scheduledDate ? formatLongDate(draft.scheduledDate) : '' },
  ];

  return (
    <Screen
      footer={
        <View>
          {createBooking.error ? (
            <Text tone="danger" center style={styles.error}>
              {createBooking.error instanceof ApiError
                ? createBooking.error.message
                : 'Could not create your booking.'}
            </Text>
          ) : null}
          <Button
            label="Continue to Payment"
            onPress={submit}
            loading={createBooking.isPending}
            disabled={!quote.data}
          />
        </View>
      }
    >
      <StepHeader title="Review your pickup" step={5} totalSteps={5} />

      <Card>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.rowDivided]}>
            <Text variant="caption" tone="muted">
              {row.label}
            </Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </Card>

      <Input
        label="Additional instructions (optional)"
        value={draft.notes}
        onChangeText={draft.setNotes}
        placeholder="e.g. Please call when you arrive."
        multiline
        numberOfLines={3}
        style={styles.notes}
      />

      <Card>
        <Text variant="h3">Price</Text>
        {quote.data ? (
          <PriceSummary
            breakdown={quote.data.breakdown}
            total={quote.data.total}
            discount={quote.data.discount}
          />
        ) : null}
      </Card>

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  row: { paddingVertical: spacing.md },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  rowValue: { marginTop: spacing.xxs },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  error: { marginBottom: spacing.sm },
  bottomSpace: { height: spacing.xl },
});
