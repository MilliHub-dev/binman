import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AddressCard, Button, EmptyState, ErrorState, LoadingState, Screen, StepHeader } from '../../components';
import { spacing } from '../../theme';
import { useAddresses } from '../../api/queries';
import { useBookingDraft } from '../../store/bookingDraft';
import type { BookingStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BookingStackParamList>;

/** Step 1 (ui.md §13) — "Where should we collect from?" */
export const SelectAddressScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<BookingStackParamList, 'SelectAddress'>>();
  const isWaste = route.params.serviceType === 'WASTE_COLLECTION';

  const { data, isLoading, error, refetch } = useAddresses();
  const selected = useBookingDraft((state) => state.address);
  const setAddress = useBookingDraft((state) => state.setAddress);

  const next = () => navigation.navigate(isWaste ? 'WasteType' : 'CleaningType');

  if (isLoading) return <Screen><LoadingState label="Loading your addresses…" /></Screen>;
  if (error) return <Screen><ErrorState error={error} onRetry={refetch} /></Screen>;

  const addresses = data ?? [];

  return (
    <Screen
      footer={
        addresses.length > 0 ? (
          <Button
            label="Continue"
            onPress={next}
            // An unserviceable address cannot proceed — the booking would be
            // rejected by the server anyway, with a worse error.
            disabled={!selected || !selected.serviceable}
          />
        ) : undefined
      }
    >
      <StepHeader
        title="Where should we collect from?"
        subtitle="Choose a saved address or add a new one."
        step={1}
        totalSteps={isWaste ? 5 : 5}
      />

      {addresses.length === 0 ? (
        <EmptyState
          icon="pin"
          title="No addresses yet"
          message="Add the address where we should collect your waste."
          actionLabel="+ Add Address"
          onAction={() => navigation.navigate('AddAddress', { returnTo: 'SelectAddress' })}
        />
      ) : (
        <View>
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              selected={selected?.id === address.id}
              onPress={() => setAddress(address)}
            />
          ))}

          <Button
            label="+ Add New Address"
            variant="secondary"
            onPress={() => navigation.navigate('AddAddress', { returnTo: 'SelectAddress' })}
            style={styles.add}
          />
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({ add: { marginTop: spacing.sm, marginBottom: spacing.xl } });
