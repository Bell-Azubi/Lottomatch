import type { CryptoPort } from '../application/platform';
import type { IdGenerator, RandomSource } from '../application/ports';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Cryptographically secure uint32 values from `crypto.getRandomValues`, buffered in blocks.
 * The domain maps them onto the pool with rejection sampling (no modulo bias).
 */
export class CryptoRandomSource implements RandomSource {
  private readonly buffer = new Uint32Array(64);
  private index = this.buffer.length;

  nextUint32(): number {
    if (this.index >= this.buffer.length) {
      crypto.getRandomValues(this.buffer);
      this.index = 0;
    }
    const value = this.buffer[this.index] ?? 0;
    this.index += 1;
    return value;
  }
}

/** RFC 4122 v4 identifiers. */
export const uuidGenerator: IdGenerator = {
  next: () => crypto.randomUUID(),
};

/** SHA-256 and PBKDF2 via Web Crypto (secure context: https or localhost). */
export const webCrypto: CryptoPort = {
  async sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return toHex(new Uint8Array(digest));
  },
  async pbkdf2Hex(secret: string, saltHex: string, iterations: number): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
      key,
      256,
    );
    return toHex(new Uint8Array(bits));
  },
  randomHex(bytes: number): string {
    return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
  },
};
