import { describe, expect, it } from 'vitest';
import { maskPhone, normalisePhone, tryNormalisePhone } from '../src/lib/phone';

/**
 * Phone normalisation is load-bearing: it is the identity key shared by the
 * app, WhatsApp and SMS. If two spellings of one number produce two strings,
 * a customer ends up with two accounts.
 */
describe('normalisePhone', () => {
  it('accepts every common Nigerian spelling of one number', () => {
    const expected = '+2348012345678';
    for (const input of [
      '08012345678',
      '8012345678',
      '2348012345678',
      '+2348012345678',
      '+234 801 234 5678',
      '0801-234-5678',
      ' 0801 234 5678 ',
      '(0801) 234 5678',
    ]) {
      expect(normalisePhone(input), `failed for ${input}`).toBe(expected);
    }
  });

  it('preserves an explicit non-Nigerian country code', () => {
    expect(normalisePhone('+447911123456')).toBe('+447911123456');
  });

  it('rejects input that cannot be a phone number', () => {
    for (const input of ['', '   ', 'abcdef', '123', '080123']) {
      expect(() => normalisePhone(input)).toThrow();
    }
  });

  it('rejects a number that is too long for E.164', () => {
    expect(() => normalisePhone('+12345678901234567890')).toThrow();
  });

  it('returns null instead of throwing in the try variant', () => {
    expect(tryNormalisePhone('nonsense')).toBeNull();
    expect(tryNormalisePhone('08012345678')).toBe('+2348012345678');
  });
});

describe('maskPhone', () => {
  it('hides the middle digits but keeps the number recognisable', () => {
    const masked = maskPhone('+2348012345678');
    expect(masked).not.toContain('012345');
    expect(masked.endsWith('678')).toBe(true);
  });
});
