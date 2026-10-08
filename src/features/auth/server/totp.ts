import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 6238 TOTP (HMAC-SHA1, 30-second steps, 6 digits): the parameters every
 * mainstream authenticator app accepts by default. Secrets travel as RFC 4648
 * base32 without padding.
 */
export const TOTP_PERIOD_MS = 30_000;
export const TOTP_DIGITS = 6;
/** Accept the previous and next step to tolerate modest clock drift. */
const TOTP_WINDOW = 1;
const SECRET_BYTES = 20;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const RECOVERY_CODE_COUNT = 10;

export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(input: string): Buffer {
  const normalized = input.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(SECRET_BYTES));
}

export function totpStep(now: number = Date.now()): number {
  return Math.floor(now / TOTP_PERIOD_MS);
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/**
 * Returns the matched time step, or null. Steps at or before `lastUsedStep`
 * are rejected so an observed code cannot be replayed inside its window.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: { now?: number; lastUsedStep?: number | null } = {},
): number | null {
  const candidate = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(candidate)) return null;
  const current = totpStep(options.now);
  const expected = Buffer.from(candidate);
  let matched: number | null = null;
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const step = current + offset;
    if (options.lastUsedStep !== null && options.lastUsedStep !== undefined && step <= options.lastUsedStep) continue;
    // Compare every window step so timing does not reveal which one matched.
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), expected) && matched === null) matched = step;
  }
  return matched;
}

export function otpauthUrl(options: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.account)}`;
  const query = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_MS / 1000),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Ten single-use codes formatted `xxxxx-xxxxx` from an unambiguous alphabet. */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(10);
    const characters = [...bytes].map((byte) => RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length]);
    return `${characters.slice(0, 5).join('')}-${characters.slice(5).join('')}`;
  });
}

/** Recovery codes carry ~49 bits of randomness, so a fast digest suffices. Case, spaces, and dashes are ignored. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toLowerCase().replace(/[\s-]/g, '')).digest('hex');
}
