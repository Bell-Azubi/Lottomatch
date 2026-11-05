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
import type { LogEnvelope } from '../../domain/types';
import { chainHash, verifyChain } from './hash-chain';
import { redactEnvelope } from './idb-stores';

/**
 * In-memory fallback when IndexedDB is unavailable (some private modes). Data lives only as long
 * as the window; the UI shows a persistent warning and offers exports.
 */
export class MemoryEventStore implements EventStore {
  private readonly logs = new Map<string, LogEnvelope[]>();

  constructor(private readonly sha256Hex: (text: string) => Promise<string>) {}

  private logOf(matchId: string): LogEnvelope[] {
    let log = this.logs.get(matchId);
    if (log === undefined) {
      log = [];
      this.logs.set(matchId, log);
    }
    return log;
  }

  async append(matchId: string, envelopes: readonly LogEnvelope[]): Promise<void> {
    const log = this.logOf(matchId);
    let previous = log.at(-1)?.hash;
    const hashed: LogEnvelope[] = [];
    for (const envelope of envelopes) {
      if (log.some((entry) => entry.seq === envelope.seq)) {
        throw new DOMException('Duplicate log sequence', 'ConstraintError');
      }
      const { hash: _h, prevHash: _p, ...plain } = envelope;
      const base: LogEnvelope = previous === undefined ? plain : { ...plain, prevHash: previous };
      const hash = await chainHash(base, previous, this.sha256Hex);
      hashed.push({ ...base, hash });
      previous = hash;
    }
    log.push(...hashed);
  }

  load(matchId: string): Promise<readonly unknown[]> {
    return Promise.resolve(structuredClone(this.logOf(matchId)));
  }

  redactPersonalData(matchId: string): Promise<number> {
    const log = this.logOf(matchId);
    let changed = 0;
    log.forEach((envelope, index) => {
      const result = redactEnvelope(envelope);
      changed += result.changed;
      log[index] = result.envelope;
    });
    return Promise.resolve(changed);
  }

  clear(matchId: string): Promise<void> {
    this.logs.set(matchId, []);
    return Promise.resolve();
  }

  async replaceAll(matchId: string, envelopes: readonly LogEnvelope[]): Promise<void> {
    await this.clear(matchId);
    await this.append(matchId, envelopes);
  }

  verify(matchId: string): Promise<ChainVerification> {
    return verifyChain(this.logOf(matchId), this.sha256Hex);
  }
}

export class MemoryDocumentStore implements DocumentStore {
  private readonly matches = new Map<string, MatchRecord>();
  private readonly catalogues = new Map<string, CatalogueRecord>();
  private readonly meta = new Map<keyof MetaRecords, unknown>();

  listMatches(): Promise<readonly unknown[]> {
    return Promise.resolve(structuredClone([...this.matches.values()]));
  }

  putMatch(match: MatchRecord): Promise<void> {
    this.matches.set(match.id, structuredClone(match));
    return Promise.resolve();
  }

  getCatalogue(matchId: string): Promise<unknown> {
    return Promise.resolve(structuredClone(this.catalogues.get(matchId)));
  }

  putCatalogue(record: CatalogueRecord): Promise<void> {
    this.catalogues.set(record.matchId, structuredClone(record));
    return Promise.resolve();
  }

  getMeta(key: keyof MetaRecords): Promise<unknown> {
    return Promise.resolve(structuredClone(this.meta.get(key)));
  }

  setMeta<K extends keyof MetaRecords>(key: K, value: MetaRecords[K]): Promise<void> {
    this.meta.set(key, structuredClone(value));
    return Promise.resolve();
  }

  deleteMeta(key: keyof MetaRecords): Promise<void> {
    this.meta.delete(key);
    return Promise.resolve();
  }
}

export class MemoryImageStore implements ImageStore {
  private readonly images = new Map<string, StoredImage>();

  put(image: StoredImage): Promise<void> {
    this.images.set(image.id, image);
    return Promise.resolve();
  }

  get(id: string): Promise<StoredImage | undefined> {
    return Promise.resolve(this.images.get(id));
  }

  delete(id: string): Promise<void> {
    this.images.delete(id);
    return Promise.resolve();
  }

  listIds(): Promise<readonly string[]> {
    return Promise.resolve([...this.images.keys()]);
  }
}
