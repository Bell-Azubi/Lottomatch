import type { BinaryCodec, Maintenance } from '../../application/platform';
import { DB_NAME, type Database } from './idb';

async function serialise(value: unknown, binary: BinaryCodec): Promise<unknown> {
  if (value instanceof Blob)
    return { blobType: value.type, base64: await binary.blobToBase64(value) };
  if (Array.isArray(value)) return Promise.all(value.map((entry) => serialise(entry, binary)));
  if (typeof value === 'object' && value !== null) {
    const entries = await Promise.all(
      Object.entries(value).map(
        async ([key, entry]) => [key, await serialise(entry, binary)] as const,
      ),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

/** Raw export and full reset for the recovery screen (IndexedDB backend). */
export function idbMaintenance(db: Database, binary: BinaryCodec): Maintenance {
  return {
    async dumpAll() {
      const stores = ['matches', 'catalogues', 'log', 'images', 'meta'] as const;
      const dump: Record<string, unknown> = {
        database: DB_NAME,
        exportedAt: new Date().toISOString(),
      };
      for (const store of stores) dump[store] = await serialise(await db.getAll(store), binary);
      return JSON.stringify(dump, null, 2);
    },
    async wipe() {
      db.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.addEventListener('success', () => {
          resolve();
        });
        request.addEventListener('error', () => {
          reject(request.error ?? new Error('deleteDatabase failed'));
        });
        request.addEventListener('blocked', () => {
          resolve();
        });
      });
    },
  };
}

/** Memory backend: nothing survives the window anyway. */
export const memoryMaintenance: Maintenance = {
  dumpAll: () => Promise.resolve(JSON.stringify({ database: 'memory' })),
  wipe: () => Promise.resolve(),
};
