import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaState } from '../application/pwa';
import { createPlatform } from './create-platform';
import { CanvasImageProcessor, MAX_BYTES } from './images';
import { registerServiceWorker } from './pwa';
import { BrowserScreenControl, BrowserStorageInfo } from './screen';

const register = vi.hoisted(() => ({
  options: undefined as undefined | Record<string, (...args: unknown[]) => void>,
  update: vi.fn(),
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: Record<string, (...args: unknown[]) => void>) => {
    register.options = options;
    return register.update;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const jpeg = () =>
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: 'image/jpeg' });

function stubCanvas(blobType: string, size: number) {
  const context = {
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingQuality: 'low',
    fillStyle: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type,
  ) {
    callback(
      new Blob([new Uint8Array(size)], {
        type: blobType === 'auto' ? (type ?? 'image/png') : blobType,
      }),
    );
  });
  return context;
}

describe('CanvasImageProcessor (FR-8 images)', () => {
  it('re-encodes to WebP within 1280 px and 400 KB', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 4000, height: 3000, close: vi.fn() })),
    );
    stubCanvas('auto', 1000);
    const result = await new CanvasImageProcessor().process(jpeg());
    expect(result).toMatchObject({ ok: true, value: { width: 1280, height: 960 } });
    if (result.ok) expect(result.value.blob.type).toBe('image/webp');
  });

  it('falls back to JPEG where WebP encoding is unsupported and shrinks oversized output', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 800, height: 600, close: vi.fn() })),
    );
    let calls = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      calls += 1;
      const big = calls < 6 ? MAX_BYTES + 1 : 10;
      callback(
        new Blob([new Uint8Array(big)], {
          type: type === 'image/webp' ? 'image/png' : 'image/jpeg',
        }),
      );
    });
    const result = await new CanvasImageProcessor().process(jpeg());
    expect(result.ok && result.value.blob.type).toBe('image/jpeg');
    expect(result.ok && result.value.width).toBeLessThan(800);
  });

  it('rejects SVG, unknown and undecodable files', async () => {
    const processor = new CanvasImageProcessor();
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], {
      type: 'image/svg+xml',
    });
    expect(await processor.process(svg)).toEqual({ ok: false, error: 'SVG_REJECTED' });
    expect(await processor.process(new Blob(['hello']))).toEqual({
      ok: false,
      error: 'UNSUPPORTED_TYPE',
    });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('no'))),
    );
    const heic = new Blob([new TextEncoder().encode('0000ftypheic0000')], { type: 'image/heic' });
    expect(await processor.process(heic)).toEqual({ ok: false, error: 'HEIC_UNSUPPORTED' });
    expect(await processor.process(jpeg())).toEqual({ ok: false, error: 'DECODE_FAILED' });
    const huge = new Blob([new Uint8Array(31 * 1024 * 1024)]);
    expect(await processor.process(huge)).toEqual({ ok: false, error: 'TOO_LARGE' });
  });
});

describe('BrowserScreenControl', () => {
  it('opens the display window, downloads files and toggles fullscreen', async () => {
    const opened = { moveTo: vi.fn(), resizeTo: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(opened as unknown as Window);
    const second = {
      availLeft: 1920,
      availTop: 0,
      availWidth: 1920,
      availHeight: 1080,
      isPrimary: false,
    };
    Object.assign(window, {
      getScreenDetails: () =>
        Promise.resolve({
          screens: [{ ...second, isPrimary: true, availLeft: 0 }, second],
          currentScreen: {},
        }),
    });
    const control = new BrowserScreenControl();
    expect(await control.openDisplay('#/display')).toBe('OPENED');
    expect(open).toHaveBeenCalledWith(
      '#/display',
      'lottomatch-display',
      expect.stringContaining('popup'),
    );
    open.mockReturnValue(null);
    expect(await control.openDisplay('#/display')).toBe('BLOCKED');
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() }),
    );
    control.download('a.json', new Blob(['{}']));
    expect(click).toHaveBeenCalled();
    Object.assign(document.documentElement, { requestFullscreen: vi.fn(() => Promise.resolve()) });
    await control.toggleFullscreen();
    expect(control.isFullscreen()).toBe(false);
  });

  it('reports storage persistence and usage', async () => {
    const manager = {
      persisted: vi.fn(() => Promise.resolve(false)),
      persist: vi.fn(() => Promise.resolve(true)),
      estimate: vi.fn(() => Promise.resolve({ usage: 10, quota: 100 })),
    };
    const info = new BrowserStorageInfo(manager as unknown as StorageManager);
    expect(await info.persist()).toBe('PERSISTED');
    manager.persist.mockResolvedValue(false);
    expect(await info.persist()).toBe('BEST_EFFORT');
    expect(await info.estimate()).toEqual({ usage: 10, quota: 100 });
    expect(await new BrowserStorageInfo(undefined).persist()).toBe('UNSUPPORTED');
    expect(await new BrowserStorageInfo(undefined).estimate()).toBeUndefined();
  });
});

describe('service worker and platform', () => {
  it('registers in prompt mode and reports each stage', async () => {
    const state = new PwaState();
    const report = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    registerServiceWorker(state, report);
    register.options?.['onRegisteredSW']?.('sw.js', { active: {} });
    register.options?.['onOfflineReady']?.();
    register.options?.['onNeedRefresh']?.();
    expect(state.status.value).toMatchObject({
      supported: true,
      registered: true,
      offlineReady: true,
      updateReady: true,
    });
    register.options?.['onRegisterError']?.(new Error('x'));
    expect(state.status.value.failed).toBe(true);
    expect(report).toHaveBeenCalled();
    await state.apply();
    expect(register.update).toHaveBeenCalledWith(true);
  });

  it('composes the browser platform on IndexedDB', async () => {
    const platform = await createPlatform({ version: '1', commit: 'c', date: 'd', baseUrl: '/' });
    expect(platform.backend).toBe('INDEXED_DB');
    expect(platform.random.nextUint32()).toBeGreaterThanOrEqual(0);
    expect(platform.clock.nowIso()).toMatch(/Z$/);
    platform.reportError(new Error('x'), 'test');
    expect(platform.diagnostics.list().at(-1)?.context).toBe('test');
  });

  it('falls back to memory storage when IndexedDB is unavailable (ADR-0016, §12)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const platform = await createPlatform({ version: '1', commit: 'c', date: 'd', baseUrl: '/' });
    expect(platform.backend).toBe('MEMORY');
    expect(platform.diagnostics.list().at(-1)?.context).toBe('indexeddb');
  });
});
