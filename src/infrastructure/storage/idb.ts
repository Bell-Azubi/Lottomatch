import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  CatalogueRecord,
  MatchRecord,
  MetaRecords,
  StoredImage,
} from '../../application/records';
import type { LogEnvelope } from '../../domain/types';

export const DB_NAME = 'lottomatch-live';
export const DB_VERSION = 1;

export interface MetaEntry {
  readonly key: keyof MetaRecords;
  readonly value: unknown;
}

/** IndexedDB layout, version 1. Later versions add steps to `upgrade`. */
export interface LottomatchDb extends DBSchema {
  matches: { key: string; value: MatchRecord };
  catalogues: { key: string; value: CatalogueRecord };
  log: { key: [string, number]; value: LogEnvelope };
  images: { key: string; value: StoredImage };
  meta: { key: string; value: MetaEntry };
}

export type Database = IDBPDatabase<LottomatchDb>;

/**
 * Opens the database. Another tab with a newer schema blocks us; we close our connection so the
 * upgrade can proceed, and the page reloads into the new version.
 */
export async function openDatabase(onVersionChange: () => void): Promise<Database> {
  return openDB<LottomatchDb>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('matches', { keyPath: 'id' });
        db.createObjectStore('catalogues', { keyPath: 'matchId' });
        db.createObjectStore('log', { keyPath: ['matchId', 'seq'] });
        db.createObjectStore('images', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
    blocking() {
      onVersionChange();
    },
  });
}

/** Key range covering every log entry of one event. */
export function logRange(matchId: string): IDBKeyRange {
  return IDBKeyRange.bound([matchId, 0], [matchId, Number.MAX_SAFE_INTEGER]);
}
