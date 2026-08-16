import { describe, expect, it } from 'vitest';
import { BookingStatus } from '@prisma/client';
import {
  assertTransition,
  canTransition,
  CUSTOMER_CANCELLABLE,
  TRANSITIONS,
} from '../src/modules/bookings/booking.status';

/**
 * The state machine is the guardrail every actor passes through — customer,
 * driver, dispatcher and payment webhook alike.
 */
describe('booking status machine', () => {
  it('walks the happy path from payment to completion', () => {
    const path = [
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.PAID,
      BookingStatus.PENDING_ASSIGNMENT,
      BookingStatus.ASSIGNED,
      BookingStatus.DRIVER_EN_ROUTE,
      BookingStatus.ARRIVED,
      BookingStatus.COLLECTED,
      BookingStatus.COMPLETED,
    ];

    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i]!, path[i + 1]!), `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it('refuses to skip payment', () => {
    expect(canTransition(BookingStatus.PENDING_PAYMENT, BookingStatus.ASSIGNED)).toBe(false);
    expect(canTransition(BookingStatus.PENDING_PAYMENT, BookingStatus.COMPLETED)).toBe(false);
  });

  it('refuses to complete a job that was never collected', () => {
    expect(canTransition(BookingStatus.ARRIVED, BookingStatus.COMPLETED)).toBe(false);
  });

  it('treats COMPLETED and CANCELLED as terminal', () => {
    expect(TRANSITIONS[BookingStatus.COMPLETED]).toHaveLength(0);
    expect(TRANSITIONS[BookingStatus.CANCELLED]).toHaveLength(0);
  });

  it('lets a failed collection be re-queued for dispatch', () => {
    expect(canTransition(BookingStatus.FAILED, BookingStatus.PENDING_ASSIGNMENT)).toBe(true);
  });

  it('allows reassignment while already assigned', () => {
    expect(canTransition(BookingStatus.ASSIGNED, BookingStatus.ASSIGNED)).toBe(true);
  });

  it('throws with both states named', () => {
    expect(() => assertTransition(BookingStatus.COMPLETED, BookingStatus.PAID)).toThrow(
      /cannot move from COMPLETED to PAID/,
    );
  });

  it('stops a customer cancelling once the truck is on the way', () => {
    expect(CUSTOMER_CANCELLABLE).not.toContain(BookingStatus.DRIVER_EN_ROUTE);
    expect(CUSTOMER_CANCELLABLE).not.toContain(BookingStatus.ARRIVED);
    expect(CUSTOMER_CANCELLABLE).not.toContain(BookingStatus.COLLECTED);
    expect(CUSTOMER_CANCELLABLE).toContain(BookingStatus.PAID);
  });

  it('never lists a status that cannot be reached', () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const target of targets) {
        expect(Object.keys(TRANSITIONS), `${from} -> ${target}`).toContain(target);
      }
    }
  });
});
