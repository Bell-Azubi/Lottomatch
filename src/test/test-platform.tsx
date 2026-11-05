import { render, type RenderResult } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { vi } from 'vitest';
import { AppStore } from '../application/app-store';
import { HostController } from '../application/host-controller';
import { HostLink } from '../application/host-link';
import { MatchAdmin } from '../application/match-admin';
import { PinService } from '../application/pin';
import type { Platform } from '../application/platform';
import type { SyncTransport } from '../application/ports';
import { PwaState } from '../application/pwa';
import type { SyncMessage } from '../application/sync-messages';
import { ok } from '../domain/result';
import { binaryCodec } from '../infrastructure/binary';
import { webCrypto } from '../infrastructure/crypto';
import { excelCsv } from '../infrastructure/csv';
import {
  MemoryDocumentStore,
  MemoryEventStore,
  MemoryImageStore,
} from '../infrastructure/storage/memory-stores';
import { memoryMaintenance } from '../infrastructure/storage/maintenance';
import { ServicesContext, type Services } from '../ui/app/context';
import { seededSource } from './domain-builders';

/** In-memory message bus shared by the windows of one test (host and display). */
export class LoopbackBus {
  private readonly handlers = new Set<(message: unknown) => void>();
  readonly sent: SyncMessage[] = [];

  transport(): SyncTransport {
    const own = new Set<(message: unknown) => void>();
    return {
      publish: (message) => {
        this.sent.push(message);
        const copy: unknown = structuredClone(message);
        for (const handler of this.handlers) if (!own.has(handler)) handler(copy);
      },
      subscribe: (handler) => {
        own.add(handler);
        this.handlers.add(handler);
        return () => {
          own.delete(handler);
          this.handlers.delete(handler);
        };
      },
    };
  }
}

/** Controllable clock: wall-clock advances one second per call, monotonic time is set by tests. */
export class TestClock {
  private wall = Date.UTC(2026, 10, 7, 18, 0, 0);
  monotonic = 10_000;

  nowIso = (): string => {
    this.wall += 1_000;
    return new Date(this.wall).toISOString();
  };

  nowMs = (): number => this.monotonic;
}

/** A complete platform backed by memory stores and deterministic fakes. */
export function createTestPlatform(overrides: Partial<Platform> = {}): Platform {
  const sha256Hex = (text: string) => webCrypto.sha256Hex(text);
  let id = 0;
  const random = seededSource(42);
  const clock = new TestClock();
  return {
    backend: 'MEMORY',
    maintenance: memoryMaintenance,
    events: new MemoryEventStore(sha256Hex),
    documents: new MemoryDocumentStore(),
    images: new MemoryImageStore(),
    random: { nextUint32: random },
    clock,
    ids: { next: () => `id-${(id += 1)}` },
    sync: new LoopbackBus().transport(),
    lock: {
      acquire: () => Promise.resolve('ACQUIRED'),
      steal: () => Promise.resolve(),
      release: () => undefined,
    },
    wakeLock: {
      supported: true,
      enable: () => Promise.resolve(true),
      disable: () => Promise.resolve(),
    },
    announcer: { supported: true, announce: vi.fn(), cancel: vi.fn() },
    sound: { play: vi.fn() },
    imageProcessor: { process: (blob) => Promise.resolve(ok({ blob, width: 64, height: 48 })) },
    csv: excelCsv,
    storage: {
      persist: () => Promise.resolve('PERSISTED'),
      estimate: () => Promise.resolve({ usage: 1_024, quota: 1_048_576 }),
    },
    screen: {
      openDisplay: vi.fn(() => Promise.resolve('OPENED' as const)),
      toggleFullscreen: vi.fn(() => Promise.resolve()),
      isFullscreen: () => false,
      download: vi.fn(),
    },
    crypto: webCrypto,
    binary: binaryCodec,
    fetchText: vi.fn(() => Promise.reject(new Error('fetchText not stubbed'))),
    build: {
      version: '1.0.0',
      commit: 'test-commit',
      date: '2026-11-05T10:00:00.000Z',
      baseUrl: '/',
    },
    diagnostics: { list: () => [], clear: vi.fn() },
    reportError: vi.fn(),
    ...overrides,
  };
}

export interface TestHost extends Services {
  readonly platform: Platform;
  readonly host: HostController;
  readonly hostLink: HostLink;
}

/** Boots a controlling host window on a test platform, with a default event. */
export async function createTestHost(overrides: Partial<Platform> = {}): Promise<TestHost> {
  const platform = createTestPlatform(overrides);
  const app = new AppStore(platform);
  const host = new HostController(app);
  const hostLink = new HostLink(app, host, 'host-window');
  const pin = new PinService(app);
  await hostLink.start();
  await app.boot('host');
  await pin.load();
  return {
    role: 'host',
    platform,
    app,
    host,
    hostLink,
    pin,
    pwa: new PwaState(),
    admin: new MatchAdmin(app),
  };
}

/** Renders UI inside the services context. */
export function renderWithServices(ui: ComponentChildren, services: Services): RenderResult {
  return render(<ServicesContext.Provider value={services}>{ui}</ServicesContext.Provider>);
}
