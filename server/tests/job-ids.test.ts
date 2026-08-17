import { describe, expect, it } from 'vitest';
import {
  SUBSCRIPTION_SWEEP_JOB_ID,
  isValidJobId,
  paymentVerifyJobId,
} from '../src/queues/jobIds';
import { generatePaymentReference } from '../src/lib/reference';

/**
 * BullMQ rejects a custom job id containing ':' — it builds its own Redis keys
 * with that character. The rule is enforced inside `queue.add`, which the
 * integration suite replaces with a fake, so nothing caught a colon-separated
 * id until it took down payments in production.
 */
describe('BullMQ job ids', () => {
  it('rejects the form that broke payment initiation', () => {
    expect(isValidJobId('verify:PAY-ABC123')).toBe(false);
  });

  it('also rejects the three-segment form BullMQ happens to tolerate', () => {
    // `verify:REF:2` passed only because BullMQ exempts exactly three segments
    // for legacy repeatable jobs. Relying on that is asking for trouble.
    expect(isValidJobId('verify:PAY-ABC123:2')).toBe(false);
  });

  it('rejects an id BullMQ would read as an integer', () => {
    expect(isValidJobId('12345')).toBe(false);
  });

  it('builds a payment verification id BullMQ will accept', () => {
    expect(isValidJobId(paymentVerifyJobId('PAY-ABC123'))).toBe(true);
    expect(isValidJobId(paymentVerifyJobId('PAY-ABC123', 3))).toBe(true);
  });

  it('accepts every id built from a real payment reference', () => {
    // References are generated, so the check has to hold for the whole alphabet
    // they can produce, not for one hand-written example.
    for (let i = 0; i < 200; i += 1) {
      const reference = generatePaymentReference();
      expect(isValidJobId(paymentVerifyJobId(reference))).toBe(true);
      expect(isValidJobId(paymentVerifyJobId(reference, 2))).toBe(true);
    }
  });

  it('keeps ids stable per reference and attempt, so a retry cannot duplicate', () => {
    expect(paymentVerifyJobId('PAY-X')).toBe(paymentVerifyJobId('PAY-X'));
    expect(paymentVerifyJobId('PAY-X', 1)).not.toBe(paymentVerifyJobId('PAY-X', 2));
  });

  it('the repeating sweep id is valid too', () => {
    expect(isValidJobId(SUBSCRIPTION_SWEEP_JOB_ID)).toBe(true);
  });
});
