import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, Text } from '../../components';
import { radius, spacing, useLayout, useStyles, type Colors, useTheme } from '../../theme';
import { images } from '../../assets';
import type { AuthStackParamList } from '../../navigation/types';

interface Slide {
  key: string;
  image: ImageSourcePropType;
  title: string;
  body: string;
}

/**
 * Onboarding (ui.md §5–7), extended to four panels because the brand artwork
 * covers four beats. The order matches the artwork: what we do, when we come,
 * what else we offer, why it matters.
 */
const SLIDES: Slide[] = [
  {
    key: 'collect',
    image: images.onboardingCollect,
    title: 'Waste collection made simple.',
    body: 'Schedule a pickup and let our team collect your waste from your doorstep.',
  },
  {
    key: 'schedule',
    image: images.onboardingSchedule,
    title: 'Schedule whenever you need us.',
    body: "Choose your preferred date and time and we'll handle the rest.",
  },
  {
    key: 'services',
    image: images.onboardingServices,
    title: 'Waste and cleaning, one app.',
    body: 'Book waste collection and professional cleaning services from one place.',
  },
  {
    key: 'planet',
    image: images.onboardingPlanet,
    title: 'Clean homes. Cleaner communities.',
    body: 'Every pickup is sorted for recycling, so less of it ends up in landfill.',
  },
];

export const OnboardingScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  // Live dimensions: re-renders on rotation, split-screen and foldable unfold.
  const { width, isSmall, scale } = useLayout();

  const isLast = index === SLIDES.length - 1;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const advance = () => {
    if (isLast) {
      navigation.navigate('Phone');
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <Screen
      padded={false}
      background={colors.surface}
      footer={
        <View>
          <Button label={isLast ? 'Get Started' : 'Next'} onPress={advance} />
          {!isLast ? (
            <Button
              label="Skip"
              variant="ghost"
              onPress={() => navigation.navigate('Phone')}
              style={styles.skip}
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.brandRow}>
        <Image source={images.logo} style={styles.logo} resizeMode="contain" />
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        // Every slide is exactly one screen wide, so the offset is arithmetic —
        // this keeps scrollToIndex accurate without measuring.
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        extraData={width}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Image
              source={item.image}
              // Art shrinks first on short screens so the copy is never clipped.
              style={{
                width: width * (isSmall ? 0.56 : 0.68),
                height: width * (isSmall ? 0.68 : 0.86),
                marginBottom: scale(24),
              }}
              resizeMode="contain"
            />
            <Text variant="h1" center style={styles.title}>
              {item.title}
            </Text>
            <Text tone="secondary" center>
              {item.body}
            </Text>
          </View>
        )}
      />

      <Pressable
        style={styles.dots}
        onPress={advance}
        accessibilityRole="tablist"
        accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </Pressable>
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  brandRow: { alignItems: 'center', paddingTop: spacing.base },
  logo: { width: 120, height: 44 },
  slide: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  title: { marginBottom: spacing.md },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: c.border,
  },
  dotActive: { width: 24, backgroundColor: c.brand },
  skip: { marginTop: spacing.xs },
});
