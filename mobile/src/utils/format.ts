/**
 * Formatting helpers shared across screens.
 *
 * MONEY: the API speaks kobo (integer minor units). ₦2,500 arrives as 250000.
 * Nothing in the UI should ever divide by 100 inline — it goes through here.
 */

export const formatNaira = (kobo: number, options: { decimals?: boolean } = {}): string => {
  const naira = kobo / 100;
  const formatted = naira.toLocaleString('en-NG', {
    minimumFractionDigits: options.decimals ? 2 : 0,
    maximumFractionDigits: options.decimals ? 2 : 0,
  });
  return `₦${formatted}`;
};

/** '2026-08-15' -> 'Saturday, 15 August' */
export const formatLongDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
};

/** '2026-08-15' -> 'Sat 15 Aug' */
export const formatShortDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const addDaysIso = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** 'Today' / 'Tomorrow' / 'Sat 15 Aug' — the date strip in ui.md §17. */
export const formatRelativeDate = (iso: string): string => {
  const today = todayIso();
  if (iso === today) return 'Today';
  if (iso === addDaysIso(today, 1)) return 'Tomorrow';
  return formatShortDate(iso);
};

/** 420 -> '7:00 AM' — mirrors the server's minutes-from-midnight slots. */
export const formatSlotTime = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** '10 minutes ago' — for the notifications feed (ui.md §37). */
export const formatTimeAgo = (isoTimestamp: string): string => {
  const then = new Date(isoTimestamp).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatShortDate(isoTimestamp.slice(0, 10));
};

/** 'Good morning' / 'Good afternoon' / 'Good evening' — the home header. */
export const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/** 'DRIVER_EN_ROUTE' -> 'Driver en route' — a readable fallback label. */
export const humanise = (value: string): string => {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/**
 * Formats as the user types: `0801 234 5678`, or `801 234 5678` when the trunk
 * zero is left off.
 *
 * The grouping follows the trunk zero rather than being fixed at 4-3-4. Typing
 * a number the way the field's own placeholder shows it — without the zero,
 * since the +234 prefix is already on screen — otherwise came out as
 * "8012 345 678", which is not how anyone in Nigeria writes their number.
 */
export const formatPhoneInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  // With the zero the leading group is four characters, without it three.
  const head = digits.startsWith('0') ? 4 : 3;
  if (digits.length <= head) return digits;
  if (digits.length <= head + 3) return `${digits.slice(0, head)} ${digits.slice(head)}`;
  return `${digits.slice(0, head)} ${digits.slice(head, head + 3)} ${digits.slice(head + 3)}`;
};
