import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, OptionCard, Screen, StepHeader, Text } from '../../components';
import { useBookingDraft } from '../../store/bookingDraft';
import type { WasteType } from '../../api/types';
import type { BookingStackParamList } from '../../navigation/types';

/** The categories offered at launch (prd.md §11, ui.md §15). */
const WASTE_TYPES: Array<{ value: WasteType; label: string; emoji: string; description?: string }> = [
  { value: 'HOUSEHOLD', label: 'Household', emoji: '🗑️', description: 'Everyday home waste' },
  { value: 'FOOD', label: 'Food waste', emoji: '🍽️', description: 'Kitchen and food scraps' },
  { value: 'PLASTIC', label: 'Plastic', emoji: '♻️', description: 'Bottles, containers, wrap' },
  { value: 'PAPER', label: 'Paper', emoji: '📄' },
  { value: 'CARDBOARD', label: 'Cardboard', emoji: '📦' },
  { value: 'GARDEN', label: 'Garden waste', emoji: '🌿', description: 'Leaves, cuttings, branches' },
  { value: 'COMMERCIAL', label: 'Commercial', emoji: '🏢', description: 'Business or shop waste' },
  { value: 'MIXED', label: 'Mixed waste', emoji: '🧺', description: 'A bit of everything' },
  { value: 'OTHER', label: 'Other', emoji: '❓' },
];

/** Step 2 — multi-select, since one pickup often mixes categories. */
export const WasteTypeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<BookingStackParamList>>();
  const selected = useBookingDraft((state) => state.wasteTypes);
  const toggle = useBookingDraft((state) => state.toggleWasteType);

  return (
    <Screen
      footer={
        <Button
          label="Continue"
          onPress={() => navigation.navigate('WasteSize')}
          disabled={selected.length === 0}
        />
      }
    >
      <StepHeader
        title="What type of waste do you have?"
        subtitle="Select all that apply."
        step={2}
        totalSteps={5}
      />

      {WASTE_TYPES.map((type) => (
        <OptionCard
          key={type.value}
          title={type.label}
          {...(type.description ? { description: type.description } : {})}
          emoji={type.emoji}
          selected={selected.includes(type.value)}
          onPress={() => toggle(type.value)}
          testID={`waste-type-${type.value}`}
        />
      ))}

      {selected.length > 1 ? (
        <Text variant="caption" tone="secondary">
          {selected.length} categories selected — we'll bring the right bags.
        </Text>
      ) : null}
    </Screen>
  );
};
