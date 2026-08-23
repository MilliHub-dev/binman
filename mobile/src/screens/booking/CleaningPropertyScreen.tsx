import React from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, OptionCard, Screen, StepHeader, Text, type IconName } from '../../components';
import { spacing } from '../../theme';
import { useBookingDraft } from '../../store/bookingDraft';
import type { PropertySize, PropertyType } from '../../api/types';
import type { BookingStackParamList } from '../../navigation/types';

/** ui.md §30 — property type and size. */
const TYPES: Array<{ value: PropertyType; label: string; icon: IconName }> = [
  { value: 'APARTMENT', label: 'Apartment', icon: 'apartment' },
  { value: 'HOUSE', label: 'House', icon: 'home' },
  { value: 'OFFICE', label: 'Office', icon: 'office' },
  { value: 'SHOP', label: 'Shop', icon: 'shop' },
  { value: 'OTHER', label: 'Other', icon: 'warehouse' },
];

const SIZES: Array<{ value: PropertySize; label: string }> = [
  { value: 'ONE_BEDROOM', label: '1 bedroom' },
  { value: 'TWO_BEDROOM', label: '2 bedrooms' },
  { value: 'THREE_BEDROOM', label: '3 bedrooms' },
  { value: 'FOUR_PLUS_BEDROOM', label: '4+ bedrooms' },
];

export const CleaningPropertyScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<BookingStackParamList>>();
  const propertyType = useBookingDraft((state) => state.propertyType);
  const propertySize = useBookingDraft((state) => state.propertySize);
  const setCleaning = useBookingDraft((state) => state.setCleaning);

  return (
    <Screen
      footer={
        <Button
          label="Continue"
          onPress={() => navigation.navigate('DateTime')}
          disabled={!propertyType || !propertySize}
        />
      }
    >
      <StepHeader title="Tell us about the property" step={3} totalSteps={5} />

      <Text variant="h3" style={styles.groupTitle}>
        Property type
      </Text>
      {TYPES.map((type) => (
        <OptionCard
          key={type.value}
          title={type.label}
          icon={type.icon}
          selected={propertyType === type.value}
          onPress={() => setCleaning({ propertyType: type.value })}
        />
      ))}

      <Text variant="h3" style={styles.groupTitle}>
        Property size
      </Text>
      {SIZES.map((size) => (
        <OptionCard
          key={size.value}
          title={size.label}
          selected={propertySize === size.value}
          onPress={() => setCleaning({ propertySize: size.value })}
        />
      ))}
    </Screen>
  );
};

const styles = StyleSheet.create({
  groupTitle: { marginBottom: spacing.md, marginTop: spacing.sm },
});
