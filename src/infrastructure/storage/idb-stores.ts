import type {
  ChainVerification,
  DocumentStore,
  EventStore,
  ImageStore,
} from '../../application/ports';
import type {
  CatalogueRecord,
  MatchRecord,
  MetaRecords,
  StoredImage,
} from '../../application/records';
import type { LogEnvelope, Winner } from '../../domain/types';
import { hasPersonalData, redactWinner } from '../../domain/winner';
import { chainHash, verifyChain } from './hash-chain';
import { logRange, type Database } from './idb';

const STRICT = { durability: 'strict' } as const;

/** Removes personal data from a stored envelope; returns the number of winners changed. */
export function redactEnvelope(envelope: LogEnvelope): { envelope: LogEnvelope; changed: number } {
  const { event } = envelope;
  if (event.type !== 'PRIZE_AWARDED' && event.type !== 'WINNER_CORRECTED')
    return { envelope, changed: 0 };
  let changed = 0;
  const redact = (winners: readonly Winner[]): Winner[] =>
    winners.map((winner) => {
      if (!hasPersonalData(winner)) return winner;
      changed += 1;
      return redactWinner(winner);
    });
  const winners = redact(event.winners);
  const next =
    event.type === 'PRIZE_AWARDED' && event.claimants !== undefined
      ? { ...event, winners, claimants: redact(event.claimants) }
      : { ...event, winners };
  return { envelope: { ...envelope, event: next }, changed };
}

/** Event log in IndexedDB with a SHA-256 hash chain and strict durability. */
export class IdbEventStore implements EventStore {
  private readonly lastHash = new Map<string, string | undefined>();

  constructor(
    private readonly db: Database,
    private readonly sha256Hex: (text: string) => Promise<string>,
  ) {}

  private async previousHash(matchId: string): Promise<string | undefined> {
    if (this.lastHash.has(matchId)) return this.lastHash.get(matchId);
    const cursor = await this.db.transaction('log').store.openCursor(logRange(matchId), 'prev');
    const hash = cursor?.value.hash;
    this.lastHash.set(matchId, hash);
    return hash;
  }

  private async hashed(matchId: string, envelopes: readonly LogEnvelope[]): Promise<LogEnvelope[]> {
    let previous = await this.previousHash(matchId);
    const result: LogEnvelope[] = [];
    for (const envelope of envelopes) {
      const { hash: _h, prevHash: _p, ...plain } = envelope;
      const base: LogEnvelope = previous === undefined ? plain : { ...plain, prevHash: previous };
      const hash = await chainHash(base, previous, this.sha256Hex);
      result.push({ ...base, hash });
      previous = hash;
    }
    return result;
  }

  async append(matchId: string, envelopes: readonly LogEnvelope[]): Promise<void> {
    const hashed = await this.hashed(matchId, envelopes);
    const tx = this.db.transaction('log', 'readwrite', STRICT);
    try {
      await Promise.all([...hashed.map((envelope) => tx.store.add(envelope)), tx.done]);
    } catch (error: unknown) {
      this.lastHash.delete(matchId);
      throw error;
    }
    this.lastHash.set(matchId, hashed.at(-1)?.hash);
  }

  async load(matchId: string): Promise<readonly unknown[]> {
    return this.db.getAll('log', logRange(matchId));
  }

  async redactPersonalData(matchId: string): Promise<number> {
    const tx = this.db.transaction('log', 'readwrite', STRICT);
    let changed = 0;
    let cursor = await tx.store.openCursor(logRange(matchId));
    while (cursor !== null) {
      const result = redactEnvelope(cursor.value);
      if (result.changed > 0) {
        changed += result.changed;
        await cursor.update(result.envelope);
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    return changed;
  }

  async clear(matchId: string): Promise<void> {
    const tx = this.db.transaction('log', 'readwrite', STRICT);
    await Promise.all([tx.store.delete(logRange(matchId)), tx.done]);
    this.lastHash.set(matchId, undefined);
  }

  async replaceAll(matchId: string, envelopes: readonly LogEnvelope[]): Promise<void> {
    await this.clear(matchId);
    if (envelopes.length > 0) await this.append(matchId, envelopes);
  }

  async verify(matchId: string): Promise<ChainVerification> {
    const log = await this.db.getAll('log', logRange(matchId));
    return verifyChain(log, this.sha256Hex);
  }
}

/** Match documents, catalogues and metadata in IndexedDB. */
export class IdbDocumentStore implements DocumentStore {
  constructor(private readonly db: Database) {}

  listMatches(): Promise<readonly unknown[]> {
    return this.db.getAll('matches');
  }

  async putMatch(match: MatchRecord): Promise<void> {
    await this.db.put('matches', match);
  }

  getCatalogue(matchId: string): Promise<unknown> {
    return this.db.get('catalogues', matchId);
  }

  async putCatalogue(record: CatalogueRecord): Promise<void> {
    await this.db.put('catalogues', record);
  }

  async getMeta(key: keyof MetaRecords): Promise<unknown> {
    return (await this.db.get('meta', key))?.value;
  }

  async setMeta<K extends keyof MetaRecords>(key: K, value: MetaRecords[K]): Promise<void> {
    await this.db.put('meta', { key, value });
  }

  async deleteMeta(key: keyof MetaRecords): Promise<void> {
    await this.db.delete('meta', key);
  }
}

/** Prize images as blobs in IndexedDB. */
export class IdbImageStore implements ImageStore {
  constructor(private readonly db: Database) {}

  async put(image: StoredImage): Promise<void> {
    await this.db.put('images', image);
  }

  get(id: string): Promise<StoredImage | undefined> {
    return this.db.get('images', id);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('images', id);
  }

  async listIds(): Promise<readonly string[]> {
    return this.db.getAllKeys('images');
  }
}
