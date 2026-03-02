import {
  validatePasswordStrength,
  PASSWORD_POLICY_MESSAGE,
} from './password.validator';

describe('validatePasswordStrength', () => {
  it('returns false for a string shorter than 8 characters', () => {
    expect(validatePasswordStrength('abc1')).toBe(false);
    expect(validatePasswordStrength('1234567')).toBe(false);
  });

  it('returns false when there is no digit', () => {
    expect(validatePasswordStrength('alllowercase')).toBe(false);
    expect(validatePasswordStrength('ALLUPPERCASE')).toBe(false);
    expect(validatePasswordStrength('NoDigitsHere')).toBe(false);
  });

  it('returns true for a valid password (8+ chars with digit)', () => {
    expect(validatePasswordStrength('validpass1')).toBe(true);
    expect(validatePasswordStrength('12345678')).toBe(true);
    expect(validatePasswordStrength('abcdefg1')).toBe(true);
  });

  it('returns false for non-string values', () => {
    expect(validatePasswordStrength(undefined as unknown as string)).toBe(false);
    expect(validatePasswordStrength(null as unknown as string)).toBe(false);
    expect(validatePasswordStrength(12345678 as unknown as string)).toBe(false);
  });

  it('PASSWORD_POLICY_MESSAGE is a non-empty string', () => {
    expect(typeof PASSWORD_POLICY_MESSAGE).toBe('string');
    expect(PASSWORD_POLICY_MESSAGE.length).toBeGreaterThan(0);
  });
});
