import { signal, type ReadonlySignal } from '@preact/signals';
import { err, ok, type Result } from '../domain/result';
import type { AppStore } from './app-store';
import { parsePin } from './schemas';

/** PBKDF2-SHA-256 work factor for the PIN hash. */
export const PIN_ITERATIONS = 210_000;
const PIN_PATTERN = /^\d{4,8}$/;

export type PinError = 'INVALID_PIN' | 'WRONG_PIN' | 'READ_ONLY';

/** Constant-time comparison of two hex strings of equal length. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1)
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/**
 * Optional 4–8 digit PIN guarding Preise and Einstellungen against accidental changes. Only a
 * salted hash is stored. It is not a security boundary: anyone with the device can reset it.
 */
export class PinService {
  private readonly isConfigured = signal(false);
  private readonly isUnlocked = signal(false);

  constructor(private readonly app: AppStore) {}

  get configured(): ReadonlySignal<boolean> {
    return this.isConfigured;
  }

  /** True when no PIN is set or it was entered in this window. */
  get unlocked(): ReadonlySignal<boolean> {
    return this.isUnlocked;
  }

  async load(): Promise<void> {
    const pin = parsePin(await this.app.platform.documents.getMeta('pin'));
    this.isConfigured.value = pin !== undefined;
    this.isUnlocked.value = pin === undefined;
  }

  private async hash(pin: string, salt: string): Promise<string> {
    return this.app.platform.crypto.pbkdf2Hex(pin, salt, PIN_ITERATIONS);
  }

  async set(pin: string): Promise<Result<void, PinError>> {
    if (!PIN_PATTERN.test(pin)) return err('INVALID_PIN');
    if (!this.app.canWrite()) return err('READ_ONLY');
    const salt = this.app.platform.crypto.randomHex(16);
    const record = { salt, hash: await this.hash(pin, salt), iterations: PIN_ITERATIONS };
    await this.app.queue.enqueue(() => this.app.platform.documents.setMeta('pin', record));
    this.isConfigured.value = true;
    this.isUnlocked.value = true;
    return ok(undefined);
  }

  async verify(pin: string): Promise<boolean> {
    const record = parsePin(await this.app.platform.documents.getMeta('pin'));
    if (record === undefined) return true;
    const hash = await this.app.platform.crypto.pbkdf2Hex(pin, record.salt, record.iterations);
    const matches = sameHash(hash, record.hash);
    if (matches) this.isUnlocked.value = true;
    return matches;
  }

  async remove(pin: string): Promise<Result<void, PinError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    if (!(await this.verify(pin))) return err('WRONG_PIN');
    await this.app.queue.enqueue(() => this.app.platform.documents.deleteMeta('pin'));
    this.isConfigured.value = false;
    this.isUnlocked.value = true;
    return ok(undefined);
  }

  /** Forgotten PIN: removes it after a type-to-confirm in the UI; audit-logged. */
  async resetForgotten(): Promise<Result<void, PinError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    await this.app.queue.enqueue(() => this.app.platform.documents.deleteMeta('pin'));
    this.app.session.value?.commit([{ type: 'PIN_RESET' }]);
    this.isConfigured.value = false;
    this.isUnlocked.value = true;
    return ok(undefined);
  }

  /** Locks the guarded pages again (e.g. when leaving them). */
  lock(): void {
    if (this.isConfigured.value) this.isUnlocked.value = false;
  }
}
