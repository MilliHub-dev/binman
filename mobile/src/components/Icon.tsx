import React from 'react';
/**
 * Imported one file per icon, via Lucide's `./icons/*` export.
 *
 * The barrel import (`from 'lucide-react-native'`) reads better but pulls all
 * ~1,500 icons into the bundle: it took the Android bundle from 3.6MB to 5.5MB
 * and the module count from 1,527 to 3,301, for a handful of glyphs. These paths cost
 * only what is used.
 */
import Bell from 'lucide-react-native/icons/bell';
import Star from 'lucide-react-native/icons/star';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import Check from 'lucide-react-native/icons/check';
import CreditCard from 'lucide-react-native/icons/credit-card';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import X from 'lucide-react-native/icons/x';
import FileText from 'lucide-react-native/icons/file-text';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Plus from 'lucide-react-native/icons/plus';
import Shield from 'lucide-react-native/icons/shield';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import House from 'lucide-react-native/icons/house';
import LogOut from 'lucide-react-native/icons/log-out';
import Moon from 'lucide-react-native/icons/moon';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Sun from 'lucide-react-native/icons/sun';
import Trash2 from 'lucide-react-native/icons/trash-2';
import User from 'lucide-react-native/icons/user';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import MapPin from 'lucide-react-native/icons/map-pin';
import Repeat from 'lucide-react-native/icons/repeat';
import Sparkles from 'lucide-react-native/icons/sparkles';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme';

/**
 * The app's icons, drawn from Lucide.
 *
 * Emoji did this job first and undercut the app badly: they render in whatever
 * style the handset vendor ships, so a screen looked like a different product
 * on a Samsung than on a Pixel, and they cannot take the brand colour. A
 * hand-rolled set replaced them and was no better — a handful of paths written
 * from memory, none of them on a consistent grid.
 *
 * Lucide is a real, maintained set on a 24px grid with matched stroke weights.
 * It renders through react-native-svg, which the app already ships, so it costs
 * no native module and no rebuild.
 *
 * Screens name icons semantically rather than importing Lucide directly, so
 * size, stroke and colour stay consistent and swapping a glyph is a one-file
 * change.
 */
const ICONS = {
  bell: Bell,
  chevron: ChevronRight,
  pin: MapPin,
  repeat: Repeat,
  cleaning: Sparkles,
  home: House,
  waste: Trash2,
  bookings: ClipboardList,
  profile: User,
  signOut: LogOut,
  light: Sun,
  dark: Moon,
  system: Smartphone,
  support: MessageCircle,
  terms: FileText,
  privacy: Shield,
  plus: Plus,
  check: Check,
  close: X,
  alert: TriangleAlert,
  card: CreditCard,
  schedule: CalendarClock,
  star: Star,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  /** Defaults to the active theme's body colour. */
  color?: string;
  /** Lucide's own default is 2; 1.8 sits better against this app's type. */
  strokeWidth?: number;
  /**
   * Fills the glyph. Lucide ships outline shapes only, so a solid star is the
   * same path with a fill — it reaches the child paths and overrides their
   * default `fill: none`.
   */
  fill?: string;
}

export const Icon: React.FC<Props> = ({ name, size = 20, color, strokeWidth = 1.8, fill }) => {
  const { colors } = useTheme();
  const Glyph = ICONS[name];

  /**
   * `IconName` should make this unreachable, but a single `as IconName` cast at
   * a call site is enough to slip an unknown name through — and rendering
   * `undefined` as a component takes down the entire screen with "Element type
   * is invalid" rather than dropping one glyph. Degrade to nothing instead.
   */
  if (!Glyph) {
    if (__DEV__) console.warn(`[Icon] no glyph named "${name}" — add it to Icon.tsx`);
    return null;
  }

  return (
    <Glyph
      size={size}
      color={color ?? colors.text}
      strokeWidth={strokeWidth}
      {...(fill ? { fill } : {})}
    />
  );
};
