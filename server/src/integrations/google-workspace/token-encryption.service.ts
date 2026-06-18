import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { GoogleWorkspaceConfigService } from './google-workspace-config.service';

/**
 * AES-256-GCM encryption for integration OAuth tokens.
 *
 * Refresh/access tokens are NEVER persisted in plaintext. The key comes from
 * `GOOGLE_INTEGRATION_ENCRYPTION_KEY`; it may be supplied as a 64-char hex
 * string, a base64 string, or any passphrase (in which case it is hashed to
 * 32 bytes with SHA-256 for convenience in dev). Ciphertext is stored as a
 * single self-describing string: `v1:<iv>:<authTag>:<ciphertext>` (base64
 * parts) so the IV is unique per value and decryption needs no side channel.
 */
@Injectable()
export class TokenEncryptionService {
  private static readonly VERSION = 'v1';
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_BYTES = 12;

  constructor(private readonly config: GoogleWorkspaceConfigService) {}

  private resolveKey(): Buffer {
    const raw = this.config.encryptionKey;
    if (!raw) {
      throw new InternalServerErrorException(
        'GOOGLE_INTEGRATION_ENCRYPTION_KEY is not configured.',
      );
    }
    // Accept a 32-byte hex key first; otherwise derive deterministically.
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    const asBase64 = Buffer.from(raw, 'base64');
    if (asBase64.length === 32) {
      return asBase64;
    }
    return createHash('sha256').update(raw, 'utf8').digest();
  }

  encrypt(plaintext: string): string {
    const key = this.resolveKey();
    const iv = randomBytes(TokenEncryptionService.IV_BYTES);
    const cipher = createCipheriv(TokenEncryptionService.ALGO, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      TokenEncryptionService.VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const key = this.resolveKey();
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== TokenEncryptionService.VERSION) {
      throw new InternalServerErrorException(
        'Malformed encrypted token payload.',
      );
    }
    const ivB64 = parts[1]!;
    const tagB64 = parts[2]!;
    const dataB64 = parts[3]!;
    const decipher = createDecipheriv(
      TokenEncryptionService.ALGO,
      key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
