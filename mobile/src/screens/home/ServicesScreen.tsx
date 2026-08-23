import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Icon, Screen, Text, type IconName } from '../../components';
import { radius, spacing, useStyles, useTheme, type Colors } from '../../theme';
import { formatNaira, humanise } from '../../utils/format';
import { usePriceList } from '../../api/queries';
import { useBookingDraft } from '../../store/bookingDraft';
import type { RootStackParamList } from '../../navigation/types';
import type { PriceListItem, ServiceType } from '../../api/types';

/**
 * ui.md §28 — what BinMan does, and what it costs.
 *
 * This was two marketing cards with stock artwork and a "From ₦X" line. The
 * picture told nobody anything they could act on, and one figure hid the fact
 * that price depends entirely on which variant you pick.
 *
 * So the artwork is gone and the price table is the page: every variant the
 * server actually prices, listed with its own figure. Someone deciding between
 * a regular and a deep clean can now see the difference before committing to a
 * booking flow, which is the only question this screen exists to answer.
 */

const SERVICES: Array<{
  type: ServiceType;
  icon: IconName;
  title: string;
  body: string;
}> = [
  {
    type: 'WASTE_COLLECTION',
    icon: 'waste',
    title: 'Waste collection',
    body: 'Household, commercial and garden waste, collected from your door on a day you choose.',
  },
  {
    type: 'CLEANING',
    icon: 'cleaning',
    title: 'Home cleaning',
    body: 'Vetted cleaners for regular upkeep, a deep clean, or a move-out handover.',
  },
];

/** The label a customer would recognise for a priced variant. */
const describeVariant = (rule: PriceListItem): string => {
  const parts = [rule.wasteType, rule.collectionSize, rule.cleaningType, rule.propertySize]
    .flatMap((part) => (part ? [humanise(part)] : []));
  return parts.join(' · ') || 'Standard';
};

export const ServicesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const startDraft = useBookingDraft((state) => state.start);
  const { data: prices, isLoading } = usePriceList();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const book = (serviceType: ServiceType) => {
    startDraft(serviceType);
    navigation.navigate('Booking', { screen: 'SelectAddress', params: { serviceType } });
  };

  return (
    <Screen>
      <Text variant="h1" style={styles.title}>
        What we do
      </Text>
      <Text tone="secondary" style={styles.intro}>
        Prices below are the base rate in your area. You will always see the full total before you
        pay.
      </Text>

      {SERVICES.map((service) => {
        const rules = (prices ?? [])
          .filter((rule) => rule.serviceType === service.type)
          .sort((a, b) => a.basePrice - b.basePrice);

        return (
          <View key={service.type} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionIcon}>
                <Icon name={service.icon} size={18} color={colors.brand} />
              </View>
              <Text variant="h3" style={styles.sectionTitle}>
                {service.title}
              </Text>
            </View>

            <Text tone="secondary" style={styles.sectionBody}>
              {service.body}
            </Text>

            {rules.length > 0 ? (
              <View style={styles.table}>
                {rules.map((rule, index) => (
                  <View
                    key={rule.id}
                    style={[styles.row, index === rules.length - 1 && styles.rowLast]}
                  >
                    <Text variant="body" style={styles.rowLabel} numberOfLines={2}>
                      {describeVariant(rule)}
                    </Text>
                    {/* Tabular figures so the column of prices lines up. */}
                    <Text variant="bodyMedium" style={styles.rowPrice}>
                      {formatNaira(rule.basePrice)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text variant="caption" tone="muted" style={styles.noPrices}>
                {isLoading ? 'Loading prices…' : 'Prices for this service are not published yet.'}
              </Text>
            )}

            <Pressable style={styles.action} onPress={() => book(service.type)}>
              <Text variant="bodyMedium" tone="brand">
                Book {service.title.toLowerCase()}
              </Text>
              <Icon name="chevron" size={18} color={colors.brand} />
            </Pressable>
          </View>
        );
      })}

      <Text variant="caption" tone="muted" style={styles.footnote}>
        Recycling collection, e-waste and bulk clearance are on the way.
      </Text>
    </Screen>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    title: { marginTop: spacing.md },
    intro: { marginTop: spacing.sm, marginBottom: spacing.xl },

    section: { marginBottom: spacing.xxl },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    sectionIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      backgroundColor: c.brandSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: { flex: 1 },
    sectionBody: { marginTop: spacing.md },

    /** A table, because the content is a price list and that is what it is. */
    table: {
      marginTop: spacing.base,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.base,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.base,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { flex: 1, color: c.textSecondary },
    rowPrice: { fontVariant: ['tabular-nums'], color: c.text },

    noPrices: { marginTop: spacing.base },

    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.base,
      paddingVertical: spacing.sm,
    },

    footnote: { marginBottom: spacing.xxl },
  });
