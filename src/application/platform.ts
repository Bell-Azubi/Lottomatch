import type { Prize } from '../domain/types';
import type {
  Announcer,
  Clock,
  CsvCodec,
  DocumentStore,
  EventStore,
  HostLock,
  IdGenerator,
  ImageProcessor,
  ImageStore,
  RandomSource,
  ScreenControl,
  SoundPlayer,
  StorageInfo,
  SyncTransport,
  WakeLock,
} from './ports';

/** Cryptographic helpers (Web Crypto). */
export interface CryptoPort {
  sha256Hex(text: string): Promise<string>;
  pbkdf2Hex(secret: string, saltHex: string, iterations: number): Promise<string>;
  randomHex(bytes: number): string;
}

/** Binary helpers for exports (images travel as base64 inside JSON). */
export interface BinaryCodec {
  blobToBase64(blob: Blob): Promise<string>;
  base64ToBlob(data: string, type: string): Blob;
  textToBlob(text: string, type: string): Blob;
}

/** Last-resort tools for the recovery screen; they bypass validation on purpose. */
export interface Maintenance {
  /** Every stored record as JSON, exactly as stored (images as base64). */
  dumpAll(): Promise<string>;
  /** Deletes all data of this app on this device. */
  wipe(): Promise<void>;
}

export type StorageBackend = 'INDEXED_DB' | 'MEMORY';

/** One entry of the local diagnostics ring buffer (no personal data). */
export interface DiagnosticEntry {
  readonly at: string;
  readonly context: string;
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

export interface Diagnostics {
  list(): readonly DiagnosticEntry[];
  clear(): void;
}

export interface BuildInfo {
  readonly version: string;
  readonly commit: string;
  readonly date: string;
  readonly baseUrl: string;
}

/** Everything the application needs from the browser, injected by the composition root. */
export interface Platform {
  readonly backend: StorageBackend;
  readonly random: RandomSource;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly events: EventStore;
  readonly documents: DocumentStore;
  readonly images: ImageStore;
  readonly sync: SyncTransport;
  readonly lock: HostLock;
  readonly wakeLock: WakeLock;
  readonly announcer: Announcer;
  readonly sound: SoundPlayer;
  readonly imageProcessor: ImageProcessor;
  readonly csv: CsvCodec;
  readonly storage: StorageInfo;
  readonly screen: ScreenControl;
  readonly crypto: CryptoPort;
  readonly binary: BinaryCodec;
  readonly maintenance: Maintenance;
  /** The prizes a new or untouched event starts with (ADR-0028). */
  readonly initialPrizes: readonly Prize[];
  /** Fetches a same-origin text file relative to the app base (prepared event files). */
  readonly fetchText: (path: string) => Promise<string>;
  readonly build: BuildInfo;
  readonly diagnostics: Diagnostics;
  /** Records an unexpected error in the local diagnostics ring buffer. */
  readonly reportError: (error: unknown, context: string) => void;
}
