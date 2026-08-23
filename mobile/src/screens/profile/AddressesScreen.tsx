import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AddressCard,
  Button,
  ConfirmModal,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Text,
} from '../../components';
import { spacing } from '../../theme';
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '../../api/queries';
import { ApiError } from '../../api/client';
import type { ProfileStackParamList } from '../../navigation/types';

/** ui.md §34 — saved addresses. */
export const AddressesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { data, isLoading, error, refetch } = useAddresses();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();
  const [deleting, setDeleting] = useState<string>();

  if (isLoading) return <Screen><LoadingState /></Screen>;
  if (error) return <Screen><ErrorState error={error} onRetry={refetch} /></Screen>;

  const addresses = data ?? [];

  return (
    <Screen
      onRefresh={refetch}
      footer={
        <Button label="+ Add Address" onPress={() => navigation.navigate('AddAddress')} />
      }
    >
      {addresses.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="No saved addresses"
          message="Add an address so we know where to collect from."
        />
      ) : (
        <View style={styles.list}>
          {addresses.map((address) => (
            <View key={address.id}>
              <AddressCard address={address} selectable={false} />
              <View style={styles.actions}>
                {!address.isDefault ? (
                  <Button
                    label="Set as default"
                    variant="ghost"
                    size="md"
                    fullWidth={false}
                    onPress={() => setDefault.mutate(address.id)}
                  />
                ) : null}
                <Button
                  label="Delete"
                  variant="ghost"
                  size="md"
                  fullWidth={false}
                  onPress={() => setDeleting(address.id)}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {remove.error ? (
        <Text tone="danger" style={styles.error}>
          {remove.error instanceof ApiError ? remove.error.message : 'Could not delete address.'}
        </Text>
      ) : null}

      <ConfirmModal
        visible={Boolean(deleting)}
        title="Delete this address?"
        message="You can add it again at any time."
        confirmLabel="Delete"
        cancelLabel="Keep"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting);
          } finally {
            setDeleting(undefined);
          }
        }}
        onCancel={() => setDeleting(undefined)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { marginTop: spacing.base },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.base,
  },
  error: { marginTop: spacing.base },
});
