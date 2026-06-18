import { TokenEncryptionService } from './token-encryption.service';
import type { GoogleWorkspaceConfigService } from './google-workspace-config.service';

function makeService(key: string): TokenEncryptionService {
  const config = { encryptionKey: key } as unknown as GoogleWorkspaceConfigService;
  return new TokenEncryptionService(config);
}

describe('TokenEncryptionService (AES-256-GCM)', () => {
  const HEX_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('round-trips a token with a 32-byte hex key', () => {
    const svc = makeService(HEX_KEY);
    const token = 'ya29.super-secret-refresh-token';
    const enc = svc.encrypt(token);
    expect(enc).not.toContain(token);
    expect(svc.decrypt(enc)).toBe(token);
  });

  it('round-trips with a passphrase key (hashed to 32 bytes)', () => {
    const svc = makeService('a-dev-passphrase-not-32-bytes');
    const token = 'refresh-abc';
    expect(svc.decrypt(svc.encrypt(token))).toBe(token);
  });

  it('produces a unique IV per call (ciphertexts differ)', () => {
    const svc = makeService(HEX_KEY);
    expect(svc.encrypt('same')).not.toEqual(svc.encrypt('same'));
  });

  it('fails to decrypt tampered ciphertext (auth tag)', () => {
    const svc = makeService(HEX_KEY);
    const enc = svc.encrypt('secret');
    const parts = enc.split(':');
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      Buffer.from('different-bytes').toString('base64'),
    ].join(':');
    expect(() => svc.decrypt(tampered)).toThrow();
  });
});
