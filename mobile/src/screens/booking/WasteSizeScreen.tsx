import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Button, OptionCard, Screen, StepHeader, Text } from '../../components';
import { useBookingDraft } from '../../store/bookingDraft';
import { getPriceList } from '../../api/endpoints';
import { keys } from '../../api/queries';
import { formatNaira } from '../../utils/format';
import type { CollectionSize } from '../../api/types';
import type { BookingStackParamList } from '../../navigation/types';

const SIZES: Array<{ value: CollectionSize; label: string; description: string }> = [
  { value: 'SMALL', label: 'Small', description: '1–2 bags' },
  { value: 'MEDIUM', label: 'Medium', description: '3–5 bags' },
  { value: 'LARGE', label: 'Large', description: '6+ bags' },
  { value: 'EXTRA_LARGE', label: 'Extra large', description: 'A full truck load' },
];

/**
 * Step 3 (ui.md §16) — "How much waste do you have?"
 *
 * Prices come from the server's price list, never from a constant in the app
 * (prd.md §12). If the list has not loaded, the cards simply show no price
 * rather than a guess.
 */
export const WasteSizeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<BookingStackParamList>>();
  const selected = useBookingDraft((state) => state.collectionSize);
  const setSize = useBookingDraft((state) => state.setCollectionSize);
  const wasteTypes = useBookingDraft((state) => state.wasteTypes);

  const { data: prices } = useQuery({ queryKey: keys.priceList, queryFn: getPriceList });

  /** Cheapest matching rule for this size — an indicative "from" price. */
  const priceFor = (size: CollectionSize): string | undefined => {
    if (!prices) return undefined;
    const matches = prices.filter(
      (rule) =>
        rule.serviceType === 'WASTE_COLLECTION' &&
        rule.collectionSize === size &&
        (rule.wasteType === null || wasteTypes.includes(rule.wasteType)),
    );
    if (matches.length === 0) return undefined;
    const cheapest = matches.reduce((a, b) => (a.basePrice <= b.basePrice ? a : b));
    return `from ${formatNaira(cheapest.basePrice)}`;
  };

  return (
    <Screen
      footer={
        <Button
          label="Continue"
          onPress={() => navigation.navigate('DateTime')}
          disabled={!selected}
        />
      }
    >
      <StepHeader
        title="How much waste do you have?"
        subtitle="An estimate is fine — the team will handle the rest."
        step={3}
        totalSteps={5}
      />

      {SIZES.map((size) => (
        <OptionCard
          key={size.value}
          title={size.label}
          description={size.description}
          icon="waste"
          {...(priceFor(size.value) ? { price: priceFor(size.value) } : {})}
          selected={selected === size.value}
          onPress={() => setSize(size.value)}
          testID={`waste-size-${size.value}`}
        />
      ))}

      <Text variant="caption" tone="muted">
        The exact price is confirmed on the next screens, before you pay.
      </Text>
    </Screen>
  );
};
