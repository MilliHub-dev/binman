import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, OptionCard, Screen, StepHeader } from '../../components';
import { useBookingDraft } from '../../store/bookingDraft';
import type { CleaningType } from '../../api/types';
import type { BookingStackParamList } from '../../navigation/types';

/** ui.md §29 — "What kind of cleaning do you need?" */
const TYPES: Array<{ value: CleaningType; label: string; emoji: string; description: string }> = [
  { value: 'REGULAR', label: 'Regular cleaning', emoji: '🧹', description: 'Routine tidy and clean' },
  { value: 'DEEP', label: 'Deep cleaning', emoji: '🧽', description: 'Top to bottom, including hard-to-reach areas' },
  { value: 'OFFICE', label: 'Office cleaning', emoji: '🏢', description: 'Workspaces and shared areas' },
  { value: 'MOVE_IN', label: 'Move-in cleaning', emoji: '📦', description: 'Ready a new home before you arrive' },
  { value: 'MOVE_OUT', label: 'Move-out cleaning', emoji: '🚚', description: 'Leave it spotless for the next tenant' },
  { value: 'POST_EVENT', label: 'Post-event cleaning', emoji: '🎉', description: 'After a party or gathering' },
];

export const CleaningTypeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<BookingStackParamList>>();
  const selected = useBookingDraft((state) => state.cleaningType);
  const setCleaning = useBookingDraft((state) => state.setCleaning);

  return (
    <Screen
      footer={
        <Button
          label="Continue"
          onPress={() => navigation.navigate('CleaningProperty')}
          disabled={!selected}
        />
      }
    >
      <StepHeader title="What kind of cleaning do you need?" step={2} totalSteps={5} />

      {TYPES.map((type) => (
        <OptionCard
          key={type.value}
          title={type.label}
          description={type.description}
          emoji={type.emoji}
          selected={selected === type.value}
          onPress={() => setCleaning({ cleaningType: type.value })}
        />
      ))}
    </Screen>
  );
};
