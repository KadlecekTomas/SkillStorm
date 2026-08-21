import { randomBytes } from 'node:crypto';

/**
 * Generates a one-time import credential with 192 bits of random entropy.
 * The fixed prefix guarantees compatibility with the global password policy;
 * the random portion provides uniqueness and unpredictability.
 */
export function generateTemporaryPassword(): string {
  return `T9!${randomBytes(24).toString('base64url')}`;
}
