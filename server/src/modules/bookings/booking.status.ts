import { BookingStatus } from '@prisma/client';
import { ConflictError } from '../../lib/errors';

/**
 * The booking lifecycle from prd.md §14, expressed as an explicit state
 * machine. Every status change in the system goes through `assertTransition`,
 * so no code path — customer, driver, dispatcher or webhook — can move a
 * booking somewhere it should not go.
 */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING_PAYMENT]: [BookingStatus.PAID, BookingStatus.CANCELLED, BookingStatus.FAILED],
  // Payment confirmed; the dispatcher queue picks it up from here.
  [BookingStatus.PAID]: [BookingStatus.PENDING_ASSIGNMENT, BookingStatus.CANCELLED],
  [BookingStatus.PENDING_ASSIGNMENT]: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED, BookingStatus.FAILED],
  // Reassignment keeps the booking in ASSIGNED, so it is a legal self-target.
  [BookingStatus.ASSIGNED]: [
    BookingStatus.ASSIGNED,
    BookingStatus.DRIVER_EN_ROUTE,
    BookingStatus.PENDING_ASSIGNMENT,
    BookingStatus.CANCELLED,
    BookingStatus.FAILED,
  ],
  [BookingStatus.DRIVER_EN_ROUTE]: [
    BookingStatus.ARRIVED,
    BookingStatus.PENDING_ASSIGNMENT,
    BookingStatus.CANCELLED,
    BookingStatus.FAILED,
  ],
  [BookingStatus.ARRIVED]: [BookingStatus.COLLECTED, BookingStatus.FAILED],
  [BookingStatus.COLLECTED]: [BookingStatus.COMPLETED, BookingStatus.FAILED],
  // Terminal states.
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.FAILED]: [BookingStatus.PENDING_ASSIGNMENT],
};

export const TERMINAL_STATUSES: BookingStatus[] = [
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
];

/** Work that still needs to happen — drives the dispatch board and counts. */
export const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.PENDING_ASSIGNMENT,
  BookingStatus.ASSIGNED,
  BookingStatus.DRIVER_EN_ROUTE,
  BookingStatus.ARRIVED,
  BookingStatus.COLLECTED,
];

export const canTransition = (from: BookingStatus, to: BookingStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const assertTransition = (from: BookingStatus, to: BookingStatus): void => {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      `A booking cannot move from ${from} to ${to}`,
      'INVALID_STATUS_TRANSITION',
      { from, to, allowed: TRANSITIONS[from] },
    );
  }
};

/** Customer-facing copy for each state (ui.md §22 timeline). */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING_PAYMENT]: 'Awaiting payment',
  [BookingStatus.PAID]: 'Booking confirmed',
  [BookingStatus.PENDING_ASSIGNMENT]: 'Finding a collection team',
  [BookingStatus.ASSIGNED]: 'Team assigned',
  [BookingStatus.DRIVER_EN_ROUTE]: 'Driver en route',
  [BookingStatus.ARRIVED]: 'Team has arrived',
  [BookingStatus.COLLECTED]: 'Waste collected',
  [BookingStatus.COMPLETED]: 'Completed',
  [BookingStatus.CANCELLED]: 'Cancelled',
  [BookingStatus.FAILED]: 'Could not be completed',
};

/** A customer may only cancel while the job has not started. */
export const CUSTOMER_CANCELLABLE: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID,
  BookingStatus.PENDING_ASSIGNMENT,
  BookingStatus.ASSIGNED,
];
