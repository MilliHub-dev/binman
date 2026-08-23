import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { Button, Icon, Input, Screen, Text } from '../../components';
import { radius, spacing, useStyles, useTheme, type Colors } from '../../theme';
import { formatShortDate, humanise } from '../../utils/format';
import { useBooking, useCreateReview } from '../../api/queries';
import { ApiError } from '../../api/client';
import type { RootStackParamList } from '../../navigation/types';

/**
 * ui.md §25 — "Rate your experience".
 *
 * Three things were missing. The screen never said *what* was being rated, so a
 * customer with two collections that week was guessing. The rating label
 * appeared only once a star was tapped, shifting everything below it. And the
 * only way to say anything specific was to type it, which almost nobody does —
 * so a one-star review arrived with no indication of what went wrong.
 *
 * Tapping a star now reveals a short list of the things that actually go right
 * or wrong on a collection, and which list you get depends on the score. It
 * takes one tap and gives operations something to act on.
 */

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** What people praise. Shown for 4 and 5. */
const GOOD_TAGS = ['Arrived on time', 'Polite team', 'Left it clean', 'Easy to reach'];

/** What actually goes wrong. Shown for 1 to 3. */
const BAD_TAGS = ['Arrived late', 'Missed the pickup', 'Left a mess', 'Hard to reach', 'Rude'];

export const RateServiceScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'RateService'>>().params;

  const { data: booking } = useBooking(bookingId);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const createReview = useCreateReview();

  const available = rating === 0 ? [] : rating >= 4 ? GOOD_TAGS : BAD_TAGS;

  const choose = (value: number) => {
    // Crossing between praise and complaint invalidates what was already
    // picked, so the tags reset rather than carrying "Rude" into a 5-star.
    const flipped = (rating >= 4) !== (value >= 4);
    setRating(value);
    if (flipped) setTags([]);
  };

  const toggleTag = (tag: string) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  const submit = async () => {
    if (rating === 0) return;

    /**
     * Tags are folded into the comment because the API stores free text only.
     * Kept on their own first line so they stay readable in the admin review
     * list, and so they could be parsed back out if they ever earn a column.
     */
    const parts = [tags.join(' · '), comment.trim()].filter(Boolean);

    await createReview.mutateAsync({
      bookingId,
      rating,
      ...(parts.length ? { comment: parts.join('\n\n') } : {}),
    });
    navigation.goBack();
  };

  return (
    <Screen
      footer={
        <Button
          label="Submit review"
          onPress={submit}
          loading={createReview.isPending}
          disabled={rating === 0}
        />
      }
    >
      <View style={styles.body}>
        {/* What is being rated — the screen never used to say. */}
        {booking ? (
          <View style={styles.subject}>
            <Icon
              name={booking.serviceType === 'CLEANING' ? 'cleaning' : 'waste'}
              size={16}
              color={colors.textSecondary}
            />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.subjectText}>
              {humanise(booking.serviceType)} · {formatShortDate(booking.scheduledDate)} ·{' '}
              {booking.reference}
            </Text>
          </View>
        ) : null}

        <Text variant="h1" center style={styles.title}>
          How did we do?
        </Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => {
            const on = rating >= value;
            return (
              <Pressable
                key={value}
                onPress={() => choose(value)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                accessibilityState={{ selected: on }}
                style={styles.starTap}
              >
                <Icon
                  name="star"
                  size={40}
                  color={on ? colors.warning : colors.borderStrong}
                  fill={on ? colors.warning : undefined}
                  strokeWidth={1.5}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Fixed height, so choosing a score does not shift the page. */}
        <View style={styles.wordSlot}>
          {rating > 0 ? (
            <Text variant="bodyMedium" center tone="secondary">
              {RATING_WORDS[rating]}
            </Text>
          ) : (
            <Text variant="caption" center tone="muted">
              Tap a star to rate
            </Text>
          )}
        </View>

        {available.length > 0 ? (
          <View style={styles.tagSection}>
            <Text variant="overline" tone="muted" style={styles.tagHeading}>
              {rating >= 4 ? 'What went well?' : 'What went wrong?'}
            </Text>
            <View style={styles.tags}>
              {available.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[styles.tag, active && styles.tagActive]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                  >
                    {active ? <Icon name="check" size={13} color={colors.brand} /> : null}
                    <Text variant="caption" style={[styles.tagText, active && styles.tagTextActive]}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.commentSection}>
        <Input
          label="Anything else? (optional)"
          value={comment}
          onChangeText={setComment}
          placeholder={
            rating > 0 && rating < 4
              ? 'Tell us what happened so we can put it right.'
              : 'Anything you would like us to know?'
          }
          multiline
          numberOfLines={4}
          maxLength={800}
          style={styles.comment}
          error={createReview.error instanceof ApiError ? createReview.error.message : undefined}
        />
        </View>
      </View>
    </Screen>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    body: { flexGrow: 1, paddingTop: spacing.lg },

    subject: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    subjectText: { flexShrink: 1 },

    title: { marginBottom: spacing.xl },

    stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
    starTap: { padding: spacing.xs },

    /** Reserved whether or not a score has been chosen. */
    wordSlot: { minHeight: 24, justifyContent: 'center', marginTop: spacing.md },

    tagSection: { marginTop: spacing.xl },
    tagHeading: { marginBottom: spacing.md, textAlign: 'center' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
    tag: {
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
    tagActive: { borderColor: c.brand, backgroundColor: c.brandSubtle },
    tagText: { color: c.textSecondary, fontWeight: '600' },
    tagTextActive: { color: c.brand },

    commentSection: { marginTop: spacing.xl },
    comment: { minHeight: 96, textAlignVertical: 'top' },
  });
