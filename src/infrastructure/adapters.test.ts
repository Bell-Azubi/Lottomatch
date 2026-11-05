import { describe, expect, it, vi } from 'vitest';
import { binaryCodec } from './binary';
import { CryptoRandomSource, uuidGenerator, webCrypto } from './crypto';
import { detectDelimiter, escapeCell, excelCsv, unguardCell } from './csv';
import { DiagnosticsLog } from './diagnostics';
import { WebHostLock } from './host-lock';
import { sniffImageType } from './images';
import { CUES, WebAudioPlayer } from './sound';
import { announcementText, pickGermanVoice, SpeechAnnouncer } from './speech';
import { BroadcastTransport, StorageEventTransport } from './sync';
import { ScreenWakeLock } from './wake-lock';

describe('crypto', () => {
  it('produces uint32 values, ids, hashes and PBKDF2 keys', async () => {
    const random = new CryptoRandomSource();
    for (let i = 0; i < 100; i += 1) {
      const value = random.nextUint32();
      expect(Number.isInteger(value) && value >= 0 && value < 2 ** 32).toBe(true);
    }
    expect(uuidGenerator.next()).toMatch(/^[0-9a-f-]{36}$/);
    expect(await webCrypto.sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    const key = await webCrypto.pbkdf2Hex('1234', '00'.repeat(16), 1_000);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(webCrypto.randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('csv', () => {
  it('detects delimiters and guards formulas', async () => {
    expect(detectDelimiter('\uFEFFRunde;Preis;Titel')).toBe(';');
    expect(detectDelimiter('Round,Prize,Title')).toBe(',');
    expect(escapeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCell('a;b')).toBe('"a;b"');
    expect(escapeCell('Zitat "x"')).toBe('"Zitat ""x"""');
    expect(escapeCell('Zitat;"x"')).toBe('"Zitat;""x"""');
    expect(unguardCell("'=SUM(A1)")).toBe('=SUM(A1)');
    expect(unguardCell("'Hallo")).toBe("'Hallo");
    const text = excelCsv.serialize(['Titel', 'Wert'], [['Präsentkorb «gross»', '50.00']]);
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    const parsed = await excelCsv.parse(text);
    expect(parsed.headers).toEqual(['Titel', 'Wert']);
    expect(parsed.rows[0]).toEqual({
      line: 2,
      cells: { Titel: 'Präsentkorb «gross»', Wert: '50.00' },
    });
  });
});

describe('images', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const ascii = (text: string) => new TextEncoder().encode(text);
  it('sniffs formats from magic bytes and rejects SVG', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('png');
    expect(sniffImageType(ascii('RIFF0000WEBPVP8 '))).toBe('webp');
    expect(sniffImageType(ascii('0000ftypheic0000'))).toBe('heic');
    expect(sniffImageType(ascii('  <?xml version="1.0"?><svg>'))).toBe('svg');
    expect(sniffImageType(ascii('hello'))).toBe('unknown');
  });
});

describe('speech and sound', () => {
  it('prefers de-CH, then de-DE, then any German voice', () => {
    const voice = (lang: string) => ({ lang }) as SpeechSynthesisVoice;
    expect(pickGermanVoice([voice('en-US'), voice('de-DE'), voice('de-CH')])?.lang).toBe('de-CH');
    expect(pickGermanVoice([voice('de_AT'), voice('de-DE')])?.lang).toBe('de-DE');
    expect(pickGermanVoice([voice('de-AT')])?.lang).toBe('de-AT');
    expect(pickGermanVoice([voice('fr-CH')])).toBeUndefined();
    expect(announcementText(42, true)).toBe('42 – 4, 2');
    expect(announcementText(7, true)).toBe('7');
    expect(announcementText(16, false)).toBe('16');
  });

  it('speaks through the synthesis API', () => {
    class Utterance {
      lang = '';
      rate = 1;
      voice: unknown = null;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    const synth = {
      getVoices: () => [{ lang: 'de-CH' }],
      addEventListener: vi.fn(),
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    const announcer = new SpeechAnnouncer(synth as unknown as SpeechSynthesis);
    announcer.announce(16, true);
    expect(synth.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: '16 – 1, 6', lang: 'de-CH' }),
    );
    announcer.cancel();
    expect(new SpeechAnnouncer(undefined).supported).toBe(false);
  });

  it('synthesises cues with Web Audio', () => {
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const node = () => ({
      connect: vi.fn((target: unknown) => target),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: param(),
      gain: param(),
      type: '',
    });
    const context = {
      state: 'suspended',
      currentTime: 0,
      resume: vi.fn(() => Promise.resolve()),
      destination: {},
      createOscillator: vi.fn(node),
      createGain: vi.fn(node),
    };
    const player = new WebAudioPlayer(() => context as unknown as AudioContext);
    player.play('mainWin');
    expect(context.createOscillator).toHaveBeenCalledTimes(CUES.mainWin.length);
    expect(context.resume).toHaveBeenCalled();
    new WebAudioPlayer(undefined).play('tick');
  });
});

describe('transports, locks and wake lock', () => {
  it('broadcasts between channels of the same name', async () => {
    const a = new BroadcastTransport(new BroadcastChannel('test-channel'));
    const b = new BroadcastTransport(new BroadcastChannel('test-channel'));
    const received: unknown[] = [];
    const unsubscribe = b.subscribe((message) => received.push(message));
    a.publish({ t: 'reload' });
    await vi.waitFor(() => {
      expect(received).toEqual([{ t: 'reload' }]);
    });
    unsubscribe();
  });

  it('falls back to storage events', () => {
    const transport = new StorageEventTransport(window.localStorage);
    const received: unknown[] = [];
    transport.subscribe((message) => received.push(message));
    transport.publish({ t: 'reload' });
    const value = window.localStorage.getItem('lottomatch-live:sync');
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'lottomatch-live:sync', newValue: value }),
    );
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'lottomatch-live:sync', newValue: '{broken' }),
    );
    expect(received).toEqual([{ t: 'reload' }]);
  });

  it('acquires, reports a stolen lock and works without Web Locks', async () => {
    let reject: (error: unknown) => void = () => undefined;
    const locks = {
      request: vi.fn(
        (
          _name: string,
          options: LockOptions,
          callback: (lock: Lock | null) => Promise<void> | undefined,
        ) => {
          if (options.ifAvailable === true && locks.request.mock.calls.length > 1) {
            void callback(null);
            return Promise.resolve();
          }
          void callback({ name: 'x', mode: 'exclusive' });
          return new Promise<void>((_resolve, rejectRequest) => {
            reject = rejectRequest;
          });
        },
      ),
    };
    const onLost = vi.fn();
    const lock = new WebHostLock(locks as unknown as LockManager);
    expect(await lock.acquire(onLost)).toBe('ACQUIRED');
    expect(await new WebHostLock(locks as unknown as LockManager).acquire(vi.fn())).toBe(
      'HELD_ELSEWHERE',
    );
    reject(new DOMException('stolen', 'AbortError'));
    await vi.waitFor(() => {
      expect(onLost).toHaveBeenCalled();
    });
    lock.release();
    expect(await new WebHostLock(undefined).acquire(vi.fn())).toBe('ACQUIRED');
  });

  it('re-acquires the wake lock when the page becomes visible', async () => {
    const sentinel = { released: false, release: vi.fn(() => Promise.resolve()) };
    const api = { request: vi.fn(() => Promise.resolve(sentinel)) };
    const wake = new ScreenWakeLock(api as unknown as WakeLock);
    expect(await wake.enable()).toBe(true);
    sentinel.released = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => {
      expect(api.request).toHaveBeenCalledTimes(2);
    });
    sentinel.released = false;
    await wake.disable();
    expect(sentinel.release).toHaveBeenCalled();
    expect(await new ScreenWakeLock(undefined).enable()).toBe(false);
  });
});

describe('diagnostics and binary codec', () => {
  it('keeps a bounded ring buffer and converts base64', async () => {
    const log = new DiagnosticsLog(window.localStorage);
    log.clear();
    for (let i = 0; i < 205; i += 1) log.record(new Error(`e${i}`), 'test');
    log.record('text', 'other');
    expect(log.list()).toHaveLength(200);
    expect(new DiagnosticsLog(window.localStorage).list().at(-1)?.message).toBe('text');
    log.clear();
    expect(log.list()).toEqual([]);
    const blob = binaryCodec.textToBlob('Grüezi', 'text/plain');
    const base64 = await binaryCodec.blobToBase64(blob);
    expect(await binaryCodec.base64ToBlob(base64, 'text/plain').text()).toBe('Grüezi');
  });
});
