import { describe, expect, it } from 'vitest';
import { createTestHost, type TestHost } from '../test/test-platform';
import { PIN_ITERATIONS, PinService, sameHash } from './pin';
import { parsePin } from './schemas';

async function readOnlyHost(first: TestHost): Promise<TestHost> {
  return createTestHost({
    documents: first.platform.documents,
    events: first.platform.events,
    lock: {
      acquire: () => Promise.resolve('HELD_ELSEWHERE'),
      steal: () => Promise.resolve(),
      release: () => undefined,
    },
  });
}

describe('sameHash', () => {
  it('compares equal-length strings in full', () => {
    expect(sameHash('abcd', 'abcd')).toBe(true);
    expect(sameHash('abcd', 'abce')).toBe(false);
    expect(sameHash('abc', 'abcd')).toBe(false);
  });
});

describe('PinService', () => {
  it('starts unlocked without a PIN', async () => {
    const { pin } = await createTestHost();
    expect(pin.configured.value).toBe(false);
    expect(pin.unlocked.value).toBe(true);
    expect(await pin.verify('anything')).toBe(true);
  });

  it('stores only a salted PBKDF2 hash and verifies the PIN', async () => {
    const { pin, platform, app } = await createTestHost();
    expect(await pin.set('12a4')).toEqual({ ok: false, error: 'INVALID_PIN' });
    expect(await pin.set('123')).toEqual({ ok: false, error: 'INVALID_PIN' });
    expect(await pin.set('123456789')).toEqual({ ok: false, error: 'INVALID_PIN' });
    expect((await pin.set('4711')).ok).toBe(true);
    const stored = parsePin(await platform.documents.getMeta('pin'));
    expect(stored?.iterations).toBe(PIN_ITERATIONS);
    expect(JSON.stringify(stored)).not.toContain('4711');
    const reloaded = new PinService(app);
    await reloaded.load();
    expect(reloaded.configured.value).toBe(true);
    expect(reloaded.unlocked.value).toBe(false);
    expect(await reloaded.verify('0000')).toBe(false);
    expect(reloaded.unlocked.value).toBe(false);
    expect(await reloaded.verify('4711')).toBe(true);
    expect(reloaded.unlocked.value).toBe(true);
    reloaded.lock();
    expect(reloaded.unlocked.value).toBe(false);
  });

  it('removes the PIN only with the current PIN', async () => {
    const { pin, platform } = await createTestHost();
    await pin.set('12345678');
    expect(await pin.remove('1111')).toEqual({ ok: false, error: 'WRONG_PIN' });
    expect((await pin.remove('12345678')).ok).toBe(true);
    expect(pin.configured.value).toBe(false);
    expect(await platform.documents.getMeta('pin')).toBeUndefined();
    pin.lock();
    expect(pin.unlocked.value).toBe(true);
  });

  it('resets a forgotten PIN and writes the audit log', async () => {
    const { pin, app } = await createTestHost();
    await pin.set('2468');
    expect((await pin.resetForgotten()).ok).toBe(true);
    expect(pin.configured.value).toBe(false);
    expect(app.session.value?.log.at(-1)?.event).toEqual({ type: 'PIN_RESET' });
  });

  it('refuses changes in a read-only window', async () => {
    const first = await createTestHost();
    await first.pin.set('1357');
    const second = await readOnlyHost(first);
    expect(second.pin.configured.value).toBe(true);
    expect(await second.pin.set('2468')).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.pin.remove('1357')).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.pin.resetForgotten()).toEqual({ ok: false, error: 'READ_ONLY' });
  });
});
