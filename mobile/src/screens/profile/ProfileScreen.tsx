import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ConfirmModal, Icon, Screen, Text, type IconName } from '../../components';
import {
  radius,
  spacing,
  useStyles,
  useTheme,
  type Colors,
  type ThemePreference,
} from '../../theme';
import { useAuthStore } from '../../store/authStore';
import type { ProfileStackParamList, RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList & RootStackParamList>;

/**
 * ui.md §33 — profile hub.
 *
 * Previously one long undifferentiated list of seven rows, each led by an
 * emoji. Everything looked equally important, so nothing was: "Personal
 * information" sat at the same weight as "Privacy policy".
 *
 * Now the rows are grouped by what they are for — your account, your
 * preferences, the legal boilerplate — and each group is labelled. Grouping is
 * the cheapest hierarchy there is, and it is honest here because these really
 * are three different kinds of thing.
 */

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: IconName }> = [
  { value: 'light', label: 'Light', icon: 'light' },
  { value: 'dark', label: 'Dark', icon: 'dark' },
  { value: 'system', label: 'System', icon: 'system' },
];

export const ProfileScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { colors, preference, setPreference } = useTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const groups: Array<{
    heading: string;
    items: Array<{ label: string; icon: IconName; onPress: () => void }>;
  }> = [
    {
      heading: 'Account',
      items: [
        {
          label: 'Personal information',
          icon: 'profile',
          onPress: () => navigation.navigate('PersonalInfo'),
        },
        { label: 'My addresses', icon: 'pin', onPress: () => navigation.navigate('Addresses') },
        {
          label: 'Regular collections',
          icon: 'repeat',
          onPress: () => navigation.navigate('Subscriptions'),
        },
      ],
    },
    {
      heading: 'Preferences',
      items: [
        {
          label: 'Notifications',
          icon: 'bell',
          onPress: () => navigation.navigate('NotificationSettings'),
        },
        { label: 'Our services', icon: 'cleaning', onPress: () => navigation.navigate('Services') },
      ],
    },
    {
      heading: 'Support & legal',
      items: [
        { label: 'Help & support', icon: 'support', onPress: () => navigation.navigate('Support') },
        { label: 'Terms & conditions', icon: 'terms', onPress: () => navigation.navigate('Terms') },
        { label: 'Privacy policy', icon: 'privacy', onPress: () => navigation.navigate('Privacy') },
      ],
    },
  ];

  return (
    <Screen>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.firstName ?? user?.phone ?? 'B').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.identityBody}>
          <Text variant="h3" numberOfLines={1}>
            {user?.fullName ?? 'BinMan customer'}
          </Text>
          <Text tone="secondary">{user?.phone}</Text>
          {user?.email ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      {/*
        Appearance sits above the menu rather than buried inside it: it is the
        one setting whose effect is visible the instant it is tapped, so showing
        the choice and the result together is the whole interaction.
      */}
      <Text variant="overline" tone="muted" style={styles.heading}>
        Appearance
      </Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setPreference(option.value)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label} theme`}
            >
              <Icon
                name={option.icon}
                size={16}
                color={active ? colors.brand : colors.textMuted}
              />
              <Text
                variant="caption"
                style={[styles.segmentLabel, active && styles.segmentLabelActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {groups.map((group) => (
        <View key={group.heading}>
          <Text variant="overline" tone="muted" style={styles.heading}>
            {group.heading}
          </Text>
          <View style={styles.menu}>
            {group.items.map((item, index) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={[styles.row, index > 0 && styles.rowDivided]}
                accessibilityRole="button"
              >
                <Icon name={item.icon} size={18} color={colors.textSecondary} />
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Icon name="chevron" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => setConfirmingSignOut(true)}
        style={styles.signOut}
        accessibilityRole="button"
      >
        <Icon name="signOut" size={18} color={colors.danger} />
        <Text tone="danger" variant="bodyMedium">
          Log out
        </Text>
      </Pressable>

      <ConfirmModal
        visible={confirmingSignOut}
        title="Log out?"
        message="You'll need your phone number to sign back in."
        confirmLabel="Log Out"
        cancelLabel="Stay Signed In"
        onConfirm={() => {
          setConfirmingSignOut(false);
          void signOut();
        }}
        onCancel={() => setConfirmingSignOut(false)}
      />

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
      marginTop: spacing.base,
      marginBottom: spacing.sm,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.textInverse, fontSize: 22, fontWeight: '700' },
    identityBody: { flex: 1 },

    heading: { marginTop: spacing.xl, marginBottom: spacing.sm },

    segment: {
      flexDirection: 'row',
      gap: spacing.xs,
      padding: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: c.surfaceSubtle,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.sm,
    },
    segmentItemActive: { backgroundColor: c.surface },
    segmentLabel: { color: c.textMuted, fontWeight: '600' },
    segmentLabelActive: { color: c.text },

    menu: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.base,
    },
    rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowLabel: { flex: 1, color: c.text },

    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      marginTop: spacing.xl,
    },
    bottomSpace: { height: spacing.xl },
  });
