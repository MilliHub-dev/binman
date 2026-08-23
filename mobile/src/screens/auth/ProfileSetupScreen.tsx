import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Input, Screen, Text } from '../../components';
import { spacing } from '../../theme';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

/** ui.md §10 — collected once, right after the first successful sign-in. */
export const ProfileSetupScreen: React.FC = () => {
  const setUser = useAuthStore((state) => state.setUser);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || loading) return;
    setError(undefined);
    setLoading(true);

    try {
      const user = await authApi.completeProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        // Email is optional; sending an empty string would fail validation.
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      // Flipping profileComplete is what moves the root navigator on.
      setUser(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      footer={
        <Button label="Continue" onPress={submit} loading={loading} disabled={!canSubmit} />
      }
    >
      <View style={styles.body}>
        <Text variant="h1">Tell us about yourself</Text>
        <Text tone="secondary" style={styles.subtitle}>
          So our collection team knows who they're coming to see.
        </Text>

        <Input
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Ekemini"
          autoCapitalize="words"
          textContentType="givenName"
          autoFocus
        />
        <Input
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          placeholder="Effiong"
          autoCapitalize="words"
          textContentType="familyName"
        />
        <Input
          label="Email address (optional)"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          hint="For receipts and booking confirmations."
          error={error}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: spacing.xl },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xl },
});
