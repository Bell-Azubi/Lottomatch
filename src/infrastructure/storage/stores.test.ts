import { describe, expect, it } from 'vitest';
import { logOf, RULES } from '../../test/domain-builders';
import type { LogEnvelope } from '../../domain/types';
import { binaryCodec } from '../binary';
import { webCrypto } from '../crypto';
import { hashInput, verifyChain } from './hash-chain';
import { DB_NAME, openDatabase } from './idb';
import { IdbDocumentStore, IdbEventStore, IdbImageStore, redactEnvelope } from './idb-stores';
import { idbMaintenance } from './maintenance';
import { MemoryDocumentStore, MemoryEventStore, MemoryImageStore } from './memory-stores';

const sha = (text: string) => webCrypto.sha256Hex(text);

const events = logOf([
  { type: 'ROUND_STARTED', round: 1, rules: RULES },
  { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 1, number: 9, method: 'RANDOM' } },
  {
    type: 'PRIZE_AWARDED',
    round: 1,
    slot: 1,
    winners: [{ cardNo: '12', name: 'Anna Muster', note: 'Tisch 4' }],
    prize: { winCondition: { kind: 'ONE_LINE' } },
  },
]).map((envelope) => ({ ...envelope, matchId: 'match-1' }));

async function freshDb() {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
  return openDatabase(() => undefined);
}

describe('IdbEventStore', () => {
  it('appends with a verifiable hash chain and rejects duplicate positions', async () => {
    const db = await freshDb();
    const store = new IdbEventStore(db, sha);
    await store.append('match-1', events.slice(0, 2));
    await store.append('match-1', events.slice(2));
    const stored = (await store.load('match-1')) as LogEnvelope[];
    expect(stored.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(stored[1]?.prevHash).toBe(stored[0]?.hash);
    expect(await store.verify('match-1')).toEqual({ ok: true, checked: 3 });
    await expect(store.append('match-1', [events[0] as LogEnvelope])).rejects.toMatchObject({
      name: 'ConstraintError',
    });
    await store.append('match-1', [{ ...(events[0] as LogEnvelope), seq: 4, id: 'x' }]);
    expect(await store.verify('match-1')).toEqual({ ok: true, checked: 4 });
    db.close();
  });

  it('erases names without breaking the chain (ADR-0005)', async () => {
    const db = await freshDb();
    const store = new IdbEventStore(db, sha);
    await store.append('match-1', events);
    expect(await store.redactPersonalData('match-1')).toBe(1);
    const stored = (await store.load('match-1')) as LogEnvelope[];
    const award = stored[2]?.event;
    expect(award?.type === 'PRIZE_AWARDED' && award.winners).toEqual([{ cardNo: '12' }]);
    expect(await store.verify('match-1')).toEqual({ ok: true, checked: 3 });
    expect(await store.redactPersonalData('match-1')).toBe(0);
    db.close();
  });

  it('detects tampering and clears or replaces logs', async () => {
    const db = await freshDb();
    const store = new IdbEventStore(db, sha);
    await store.append('match-1', events);
    const stored = (await store.load('match-1')) as LogEnvelope[];
    const tampered = stored.map((e, i) =>
      i === 1 && e.event.type === 'NUMBER_DRAWN'
        ? { ...e, event: { ...e.event, draw: { ...e.event.draw, number: 10 } } }
        : e,
    );
    expect(await verifyChain(tampered, sha)).toEqual({ ok: false, brokenAt: 2 });
    await store.replaceAll('match-1', events.slice(0, 1));
    expect(await store.load('match-1')).toHaveLength(1);
    await store.clear('match-1');
    expect(await store.load('match-1')).toHaveLength(0);
    db.close();
  });

  it('stores documents, metadata and images, and dumps everything for recovery', async () => {
    const db = await freshDb();
    const documents = new IdbDocumentStore(db);
    const images = new IdbImageStore(db);
    await documents.setMeta('activeMatchId', 'match-1');
    expect(await documents.getMeta('activeMatchId')).toBe('match-1');
    await documents.deleteMeta('activeMatchId');
    expect(await documents.getMeta('activeMatchId')).toBeUndefined();
    await documents.putCatalogue({ matchId: 'match-1', version: 1, prizes: [] });
    expect(await documents.getCatalogue('match-1')).toEqual({
      matchId: 'match-1',
      version: 1,
      prizes: [],
    });
    const blob = new Blob(['img'], { type: 'image/webp' });
    await images.put({ id: 'i1', blob, width: 2, height: 2, createdAt: 'now' });
    expect(await images.listIds()).toEqual(['i1']);
    const dump = JSON.parse(await idbMaintenance(db, binaryCodec).dumpAll()) as Record<
      string,
      unknown
    >;
    expect(dump['database']).toBe(DB_NAME);
    await images.delete('i1');
    expect(await images.get('i1')).toBeUndefined();
    await idbMaintenance(db, binaryCodec).wipe();
  });
});

describe('memory stores', () => {
  it('behave like the IndexedDB stores', async () => {
    const store = new MemoryEventStore(sha);
    await store.append('m', events);
    expect(await store.verify('m')).toEqual({ ok: true, checked: 3 });
    await expect(store.append('m', [events[0] as LogEnvelope])).rejects.toMatchObject({
      name: 'ConstraintError',
    });
    expect(await store.redactPersonalData('m')).toBe(1);
    await store.replaceAll('m', events.slice(0, 2));
    expect(await store.load('m')).toHaveLength(2);
    const documents = new MemoryDocumentStore();
    await documents.setMeta('hostEpoch', 3);
    expect(await documents.getMeta('hostEpoch')).toBe(3);
    await documents.deleteMeta('hostEpoch');
    expect(await documents.listMatches()).toEqual([]);
    const images = new MemoryImageStore();
    await images.put({ id: 'a', blob: new Blob(), width: 1, height: 1, createdAt: '' });
    expect(await images.listIds()).toEqual(['a']);
    await images.delete('a');
    expect(await images.get('a')).toBeUndefined();
  });

  it('excludes names from the hashed text and leaves other events untouched', () => {
    const award = events[2] as LogEnvelope;
    expect(hashInput(award)).not.toContain('Anna');
    expect(hashInput(award)).toContain('"cardNo":"12"');
    expect(redactEnvelope(events[0] as LogEnvelope).changed).toBe(0);
  });
});
