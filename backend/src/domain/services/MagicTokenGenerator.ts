import { randomBytes, createHash } from 'crypto';

const DEFAULT_VALIDITY_MS = 48 * 60 * 60 * 1000;

export function generateMagicToken(validityMs = DEFAULT_VALIDITY_MS): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + validityMs);
  return { rawToken, tokenHash, expiresAt };
}

export function hashMagicToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}