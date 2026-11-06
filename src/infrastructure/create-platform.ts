import type { BuildInfo, Platform } from '../application/platform';
import type { DocumentStore, EventStore, ImageStore } from '../application/ports';
import { EVENT_PRIZE_LIST } from '../application/event-prize-list';
import { binaryCodec, fetchText } from './binary';
import { CryptoRandomSource, uuidGenerator, webCrypto } from './crypto';
import { excelCsv } from './csv';
import { DiagnosticsLog } from './diagnostics';
import { WebHostLock } from './host-lock';
import { CanvasImageProcessor } from './images';
import { BrowserScreenControl, BrowserStorageInfo } from './screen';
import { WebAudioPlayer } from './sound';
import { SpeechAnnouncer } from './speech';
import { openDatabase } from './storage/idb';
import { idbMaintenance, memoryMaintenance } from './storage/maintenance';
import { IdbDocumentStore, IdbEventStore, IdbImageStore } from './storage/idb-stores';
import { MemoryDocumentStore, MemoryEventStore, MemoryImageStore } from './storage/memory-stores';
import { createSyncTransport } from './sync';
import { ScreenWakeLock } from './wake-lock';

interface Stores {
  readonly backend: Platform['backend'];
  readonly maintenance: Platform['maintenance'];
  readonly events: EventStore;
  readonly documents: DocumentStore;
  readonly images: ImageStore;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

async function openStores(diagnostics: DiagnosticsLog): Promise<Stores> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
    const db = await openDatabase(() => {
      window.location.reload();
    });
    return {
      backend: 'INDEXED_DB',
      maintenance: idbMaintenance(db, binaryCodec),
      events: new IdbEventStore(db, (text) => webCrypto.sha256Hex(text)),
      documents: new IdbDocumentStore(db),
      images: new IdbImageStore(db),
    };
  } catch (error: unknown) {
    diagnostics.record(error, 'indexeddb');
    return {
      backend: 'MEMORY',
      maintenance: memoryMaintenance,
      events: new MemoryEventStore((text) => webCrypto.sha256Hex(text)),
      documents: new MemoryDocumentStore(),
      images: new MemoryImageStore(),
    };
  }
}

/** Composition root of the browser adapters behind the application ports. */
export async function createPlatform(build: BuildInfo): Promise<Platform> {
  const diagnostics = new DiagnosticsLog(safeLocalStorage());
  const stores = await openStores(diagnostics);
  const AudioContextClass = typeof AudioContext === 'function' ? AudioContext : undefined;
  return {
    ...stores,
    random: new CryptoRandomSource(),
    clock: { nowIso: () => new Date().toISOString(), nowMs: () => performance.now() },
    ids: uuidGenerator,
    sync: createSyncTransport(),
    lock: new WebHostLock('locks' in navigator ? navigator.locks : undefined),
    wakeLock: new ScreenWakeLock('wakeLock' in navigator ? navigator.wakeLock : undefined),
    announcer: new SpeechAnnouncer(
      'speechSynthesis' in window ? window.speechSynthesis : undefined,
    ),
    sound: new WebAudioPlayer(
      AudioContextClass === undefined ? undefined : () => new AudioContextClass(),
    ),
    imageProcessor: new CanvasImageProcessor(),
    csv: excelCsv,
    storage: new BrowserStorageInfo('storage' in navigator ? navigator.storage : undefined),
    screen: new BrowserScreenControl(),
    crypto: webCrypto,
    binary: binaryCodec,
    initialPrizes: EVENT_PRIZE_LIST,
    fetchText,
    build,
    diagnostics,
    reportError: (error, context) => {
      diagnostics.record(error, context);
    },
  };
}
