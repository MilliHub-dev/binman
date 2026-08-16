/** Shared formatting. The API speaks kobo; nothing divides by 100 inline. */

export const naira = (kobo: number, decimals = false): string =>
  `₦${(kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;

export const humanise = (value: string): string => {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export const shortDate = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export const longDate = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

export const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

export const today = (): string => new Date().toISOString().slice(0, 10);

export const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

/**
 * Booking status → semantic tone.
 *
 * Amber means a human needs to act, blue means it is moving through the system,
 * green means done, red means it failed. An operator should be able to scan a
 * column and see what needs them without reading a word.
 */
export const statusTone = (
  status: string,
): { bg: string; fg: string; label: string } => {
  const map: Record<string, { bg: string; fg: string }> = {
    PENDING_PAYMENT: { bg: 'bg-warn-bg', fg: 'text-warn-fg' },
    PAID: { bg: 'bg-brand-50', fg: 'text-brand-800' },
    PENDING_ASSIGNMENT: { bg: 'bg-warn-bg', fg: 'text-warn-fg' },
    ASSIGNED: { bg: 'bg-brand-50', fg: 'text-brand-800' },
    DRIVER_EN_ROUTE: { bg: 'bg-leaf-50', fg: 'text-leaf-800' },
    ARRIVED: { bg: 'bg-leaf-50', fg: 'text-leaf-800' },
    COLLECTED: { bg: 'bg-leaf-50', fg: 'text-leaf-800' },
    COMPLETED: { bg: 'bg-ok-bg', fg: 'text-ok-fg' },
    CANCELLED: { bg: 'bg-ink-100', fg: 'text-ink-600' },
    FAILED: { bg: 'bg-danger-bg', fg: 'text-danger-fg' },
    SUCCESSFUL: { bg: 'bg-ok-bg', fg: 'text-ok-fg' },
    PENDING: { bg: 'bg-warn-bg', fg: 'text-warn-fg' },
    AVAILABLE: { bg: 'bg-ok-bg', fg: 'text-ok-fg' },
    BUSY: { bg: 'bg-warn-bg', fg: 'text-warn-fg' },
    OFFLINE: { bg: 'bg-ink-100', fg: 'text-ink-600' },
    SUSPENDED: { bg: 'bg-danger-bg', fg: 'text-danger-fg' },
    ACTIVE: { bg: 'bg-ok-bg', fg: 'text-ok-fg' },
    ON_ROUTE: { bg: 'bg-leaf-50', fg: 'text-leaf-800' },
    MAINTENANCE: { bg: 'bg-warn-bg', fg: 'text-warn-fg' },
    OUT_OF_SERVICE: { bg: 'bg-danger-bg', fg: 'text-danger-fg' },
    VERIFIED: { bg: 'bg-ok-bg', fg: 'text-ok-fg' },
    REJECTED: { bg: 'bg-danger-bg', fg: 'text-danger-fg' },
  };
  return { ...(map[status] ?? { bg: 'bg-ink-100', fg: 'text-ink-600' }), label: humanise(status) };
};
