import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { Button, Input, Screen, Text } from '../../components';
import { spacing } from '../../theme';
import { updateProfile } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../api/client';

export const PersonalInfoScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      setUser(updated);
      setSaved(true);
    },
  });

  const dirty =
    firstName !== (user?.firstName ?? '') ||
    lastName !== (user?.lastName ?? '') ||
    email !== (user?.email ?? '');

  return (
    <Screen
      footer={
        <Button
          label="Save Changes"
          onPress={() =>
            save.mutate({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              // null clears the address; an empty string would fail validation.
              email: email.trim() || null,
            })
          }
          loading={save.isPending}
          disabled={!dirty || !firstName.trim() || !lastName.trim()}
        />
      }
    >
      <Input
        label="First name"
        value={firstName}
        onChangeText={(v) => {
          setFirstName(v);
          setSaved(false);
        }}
        autoCapitalize="words"
        style={styles.first}
      />
      <Input
        label="Last name"
        value={lastName}
        onChangeText={(v) => {
          setLastName(v);
          setSaved(false);
        }}
        autoCapitalize="words"
      />
      <Input
        label="Email address"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setSaved(false);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        error={save.error instanceof ApiError ? save.error.message : undefined}
      />

      <Input
        label="Phone number"
        value={user?.phone ?? ''}
        editable={false}
        // The phone number IS the account identity, so it cannot be edited here.
        hint="Your phone number is your BinMan ID. Contact support to change it."
      />

      {saved ? (
        <Text tone="success" center>
          ✓ Saved
        </Text>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({ first: { marginTop: spacing.lg } });
