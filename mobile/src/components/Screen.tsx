import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useLayout, useStyles, type Colors, useTheme } from '../theme';

interface Props {
  children: React.ReactNode;
  /** Wraps content in a ScrollView. Off for screens with their own FlatList. */
  scroll?: boolean;
  /** Pinned to the bottom above the safe area — the primary action lives here. */
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Defaults to the active theme's page background. */
  background?: string;
  /**
   * Overrides the footer's own surface. Screens painting their own background
   * use this to drop the opaque bar, which would otherwise cut the artwork with
   * a hard seam a hundred points from the bottom.
   */
  footerStyle?: StyleProp<ViewStyle>;
}

/**
 * Every screen's outer shell: safe areas, keyboard avoidance, optional
 * pull-to-refresh, and a footer that stays put while the body scrolls.
 *
 * Keeping this in one place is what stops the primary button from ending up at
 * a slightly different height on each screen.
 */
export const Screen: React.FC<Props> = ({
  children,
  scroll = true,
  footer,
  refreshing,
  onRefresh,
  padded = true,
  edges = ['top'],
  style,
  contentStyle,
  background,
  footerStyle,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { gutter, maxContentWidth, width } = useLayout();

  // Padding tracks the screen width, and content is centred with a max width so
  // a tablet or unfolded foldable does not stretch a form across the display.
  const pad = padded ? { paddingHorizontal: gutter } : null;
  const centred =
    width > maxContentWidth ? { maxWidth: maxContentWidth, alignSelf: 'center' as const, width: '100%' as const } : null;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[pad, styles.grow, centred, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, pad, centred, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background ?? colors.background }, style]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // On iOS the header already offsets the keyboard; without this the
        // footer button hides behind it on smaller devices.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {body}
        {footer ? (
          <View style={[styles.footer, { paddingHorizontal: gutter }, centred, footerStyle]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  footer: {
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
});
