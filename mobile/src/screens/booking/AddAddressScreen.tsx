import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { Button, Icon, Input, MapPicker, Screen, Text, type IconName } from '../../components';
import { radius, spacing, useStyles, useTheme, type Colors } from '../../theme';
import { useCreateAddress } from '../../api/queries';
import { reverseGeocode, searchAddress } from '../../api/endpoints';
import { useBookingDraft } from '../../store/bookingDraft';
import { ApiError } from '../../api/client';
import type { GeoResult } from '../../api/types';

/**
 * ui.md §14 — add an address.
 *
 * Two things drive the design. A customer almost always means one of a handful
 * of places, so the label is a set of choices rather than a text box nobody
 * fills in consistently ("home", "Home", "my house"). And an address in Uyo is
 * frequently not findable from its street line alone, so the map is here to let
 * someone put the pin on their actual gate — which is what the driver navigates
 * to.
 */

/** Uyo's centre, used until we know anything better about the customer. */
const UYO = { latitude: 5.0378, longitude: 7.9128 };

/**
 * "Other" is part of this list rather than spread in at the call site. Spreading
 * widened `icon` back to `string`, which is what let an icon name that does not
 * exist reach the renderer and blank the screen.
 */
const PRESETS: ReadonlyArray<{ label: string; icon: IconName }> = [
  { label: 'Home', icon: 'home' },
  { label: 'Office', icon: 'bookings' },
  { label: 'Business', icon: 'waste' },
  { label: 'Other', icon: 'plus' },
];

export const AddAddressScreen: React.FC = () => {
  const navigation = useNavigation();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const createAddress = useCreateAddress();
  const setDraftAddress = useBookingDraft((state) => state.setAddress);

  const [preset, setPreset] = useState<string>('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('Uyo');
  const [state, setState] = useState('Akwa Ibom');
  const [instructions, setInstructions] = useState('');
  const [point, setPoint] = useState(UYO);
  const [pinned, setPinned] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string>();

  const label = preset === 'Other' ? customLabel.trim() : preset;
  const canSave =
    label.length > 0 && addressLine.trim().length > 2 && area.trim() && city.trim() && state.trim();

  /**
   * Fills the form from a geocoded place and drops the pin on it.
   *
   * Reads the structured fields the API now returns rather than slicing the
   * formatted string: Mapbox writes "Ikot Ekpene Road, Uyo 52, Akwa Ibom", so
   * splitting on commas put the postcode in the area box and the state in the
   * city box.
   */
  const applyPlace = (place: GeoResult) => {
    setPoint({ latitude: place.latitude, longitude: place.longitude });
    setPinned(true);

    if (place.street) setAddressLine(place.street);
    if (place.neighborhood) setArea(place.neighborhood);
    if (place.city) setCity(place.city);
    if (place.state) setState(place.state);

    if (place.coverage?.serviceable === false) {
      setNote(`We don't collect in ${place.coverage.areaName ?? 'this area'} yet.`);
    } else {
      setNote(undefined);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    setNote(undefined);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNote('Location permission denied. Search for your address instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setPoint({ latitude, longitude });
      setPinned(true);
      // Reverse geocoding runs on our server so the Mapbox token stays there.
      applyPlace(await reverseGeocode(latitude, longitude));
    } catch {
      setNote('Could not find your location. Search for your address instead.');
    } finally {
      setLocating(false);
    }
  };

  const lookUp = async () => {
    const query = addressLine.trim();
    if (query.length < 3) return;
    setSearching(true);
    setNote(undefined);
    try {
      const place = await searchAddress(`${query}, ${area || city}, ${state}`);
      applyPlace(place);
    } catch (err) {
      setNote(
        err instanceof ApiError ? err.message : 'Could not find that address. Move the pin instead.',
      );
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    const address = await createAddress.mutateAsync({
      label,
      addressLine: addressLine.trim(),
      area: area.trim(),
      city: city.trim(),
      state: state.trim(),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      // Only send coordinates the customer actually placed. Uyo's centre is a
      // starting view, not an address, and saving it would send drivers there.
      ...(pinned ? point : {}),
    });

    setDraftAddress(address);
    navigation.goBack();
  };

  return (
    <Screen
      footer={
        <Button
          label="Save address"
          onPress={save}
          loading={createAddress.isPending}
          disabled={!canSave}
        />
      }
    >
      <Text variant="overline" tone="muted" style={styles.heading}>
        What is this place?
      </Text>
      <View style={styles.presets}>
        {PRESETS.map((option) => {
          const active = preset === option.label;
          return (
            <Pressable
              key={option.label}
              onPress={() => setPreset(option.label)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Icon
                name={option.icon}
                size={15}
                color={active ? colors.brand : colors.textMuted}
              />
              <Text variant="caption" style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {preset === 'Other' ? (
        <Input
          value={customLabel}
          onChangeText={setCustomLabel}
          placeholder="Shop, Mum's place, Site…"
          maxLength={40}
          style={styles.customLabel}
        />
      ) : null}

      <Text variant="overline" tone="muted" style={styles.heading}>
        Where is it?
      </Text>

      <Pressable style={styles.locate} onPress={useMyLocation} disabled={locating}>
        <Icon name="pin" size={16} color={colors.brand} />
        <Text variant="bodyMedium" tone="brand">
          {locating ? 'Finding you…' : 'Use my current location'}
        </Text>
      </Pressable>

      <MapPicker
        latitude={point.latitude}
        longitude={point.longitude}
        onChange={(next) => {
          setPoint(next);
          setPinned(true);
        }}
      />

      {note ? (
        <Text variant="caption" tone="danger" style={styles.note}>
          {note}
        </Text>
      ) : null}

      <View style={styles.form}>
        <Input
          label="House number and street"
          value={addressLine}
          onChangeText={setAddressLine}
          placeholder="15 Udo Udoma Avenue"
          onBlur={lookUp}
          hint={searching ? 'Looking it up…' : 'We will find it on the map when you move on.'}
        />
        <Input label="Area" value={area} onChangeText={setArea} placeholder="Ewet Housing Estate" />
        <Input label="City" value={city} onChangeText={setCity} placeholder="Uyo" />
        <Input label="State" value={state} onChangeText={setState} placeholder="Akwa Ibom" />
        <Input
          label="Landmark or directions (optional)"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Blue gate, opposite the pharmacy"
          multiline
          numberOfLines={2}
          style={styles.multiline}
          error={createAddress.error instanceof ApiError ? createAddress.error.message : undefined}
        />
      </View>
    </Screen>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    heading: { marginTop: spacing.lg, marginBottom: spacing.sm },

    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.base,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipActive: { borderColor: c.brand, backgroundColor: c.brandSubtle },
    chipLabel: { color: c.textSecondary, fontWeight: '600' },
    chipLabelActive: { color: c.brand },
    customLabel: { marginTop: spacing.md },

    locate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    note: { marginTop: spacing.sm },
    form: { marginTop: spacing.xl },
    multiline: { minHeight: 64, textAlignVertical: 'top' },
  });
