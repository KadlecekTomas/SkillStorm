import * as crypto from 'crypto';
import { hashToken, matchesTokenHash, timingSafeEqualHex } from './token.util';

describe('token.util', () => {
  it('hashToken returns sha256 hex (64 chars)', () => {
    const hashed = hashToken('sample-refresh-token');
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    expect(hashed.length).toBe(64);
  });

  it('matchesTokenHash uses timingSafeEqual and validates token hash', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    const raw = 'raw-token-value';
    const stored = hashToken(raw);

    expect(matchesTokenHash(raw, stored)).toBe(true);
    expect(matchesTokenHash('other-token', stored)).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('timingSafeEqualHex returns false on different lengths', () => {
    expect(timingSafeEqualHex('aa', 'bbbb')).toBe(false);
  });
});
