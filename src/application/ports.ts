import type { Result } from '../domain/result';
import type { LogEnvelope } from '../domain/types';
import type { CatalogueRecord, MatchRecord, MetaRecords, StoredImage } from './records';
import type { SyncMessage } from './sync-messages';

/** Uniform unsigned 32-bit integers from a cryptographically secure source. */
export interface RandomSource {
  nextUint32(): number;
}

/** Wall-clock and monotonic time. Wall-clock time is informational only (I7). */
export interface Clock {
  nowIso(): string;
  nowMs(): number;
}

export interface IdGenerator {
  next(): string;
}

export type ChainVerification =
  | { readonly ok: true; readonly checked: number }
  | { readonly ok: false; readonly brokenAt: number };

/** Append-only log storage per event (hash chain computed on append). */
export interface EventStore {
  append(matchId: string, envelopes: readonly LogEnvelope[]): Promise<void>;
  load(matchId: string): Promise<readonly unknown[]>;
  /** Removes names and notes from every stored winner; returns the number of winners changed. */
  redactPersonalData(matchId: string): Promise<number>;
  clear(matchId: string): Promise<void>;
  replaceAll(matchId: string, envelopes: readonly LogEnvelope[]): Promise<void>;
  /** Verifies the stored hash chain (tamper evidence). */
  verify(matchId: string): Promise<ChainVerification>;
}

/** Versioned documents: events, prize catalogues and device-level metadata. */
export interface DocumentStore {
  listMatches(): Promise<readonly unknown[]>;
  putMatch(match: MatchRecord): Promise<void>;
  getCatalogue(matchId: string): Promise<unknown>;
  putCatalogue(record: CatalogueRecord): Promise<void>;
  getMeta(key: keyof MetaRecords): Promise<unknown>;
  setMeta<K extends keyof MetaRecords>(key: K, value: MetaRecords[K]): Promise<void>;
  deleteMeta(key: keyof MetaRecords): Promise<void>;
}

export interface ImageStore {
  put(image: StoredImage): Promise<void>;
  get(id: string): Promise<StoredImage | undefined>;
  delete(id: string): Promise<void>;
  listIds(): Promise<readonly string[]>;
}

/** Cross-window messaging between host and display windows. */
export interface SyncTransport {
  publish(message: SyncMessage): void;
  subscribe(handler: (message: unknown) => void): () => void;
}

export type LockOutcome = 'ACQUIRED' | 'HELD_ELSEWHERE';

/** Exactly one controlling host window (Web Locks). */
export interface HostLock {
  acquire(onLost: () => void): Promise<LockOutcome>;
  steal(onLost: () => void): Promise<void>;
  release(): void;
}

export interface WakeLock {
  readonly supported: boolean;
  enable(): Promise<boolean>;
  disable(): Promise<void>;
}

export interface Announcer {
  readonly supported: boolean;
  announce(number: number, withDigits: boolean): void;
  cancel(): void;
}

export type SoundCue = 'tick' | 'reveal' | 'win' | 'superlottoWin' | 'error';

export interface SoundPlayer {
  play(cue: SoundCue): void;
}

export type ImageError =
  'UNSUPPORTED_TYPE' | 'SVG_REJECTED' | 'HEIC_UNSUPPORTED' | 'DECODE_FAILED' | 'TOO_LARGE';

export interface ProcessedImage {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
}

export interface ImageProcessor {
  process(file: Blob): Promise<Result<ProcessedImage, ImageError>>;
}

export interface CsvRow {
  readonly line: number;
  readonly cells: Readonly<Record<string, string>>;
}

export interface CsvCodec {
  parse(
    text: string,
  ): Promise<{ readonly headers: readonly string[]; readonly rows: readonly CsvRow[] }>;
  serialize(headers: readonly string[], rows: readonly (readonly string[])[]): string;
}

export type StoragePersistence = 'PERSISTED' | 'BEST_EFFORT' | 'UNSUPPORTED';

export interface StorageInfo {
  persist(): Promise<StoragePersistence>;
  estimate(): Promise<{ readonly usage: number; readonly quota: number } | undefined>;
}

export type DisplayOpenResult = 'OPENED' | 'BLOCKED';

/** Window, screen and file capabilities of the browser. */
export interface ScreenControl {
  openDisplay(url: string): Promise<DisplayOpenResult>;
  toggleFullscreen(): Promise<void>;
  isFullscreen(): boolean;
  download(fileName: string, content: Blob): void;
}
