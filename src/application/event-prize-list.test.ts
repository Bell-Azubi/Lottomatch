import { describe, expect, it } from 'vitest';
import { validatePrize } from '../domain/catalogue';
import { defaultSettings } from '../domain/settings';
import { webCrypto } from '../infrastructure/crypto';
import { MemoryDocumentStore, MemoryEventStore } from '../infrastructure/storage/memory-stores';
import { createTestHost, createTestPlatform } from '../test/test-platform';
import { AppStore } from './app-store';
import { EVENT_PRIZE_LIST } from './event-prize-list';
import { activePrizeView } from './selectors';

const DEFAULTS = defaultSettings('Lottomatch');

const titles = (round: number) =>
  EVENT_PRIZE_LIST.filter((prize) => prize.round === round).map((prize) => prize.title);

describe('the prize list of the event', () => {
  it('has four prizes per round and a Superlotto in rounds 4, 9, 14, 19 and 24', () => {
    expect(EVENT_PRIZE_LIST).toHaveLength(101);
    expect(new Set(EVENT_PRIZE_LIST.map((prize) => prize.round)).size).toBe(24);
    expect(
      EVENT_PRIZE_LIST.filter((prize) => prize.slot === 5).map((prize) => prize.round),
    ).toEqual([4, 9, 14, 19, 24]);
    expect(titles(1)).toEqual(['1/2 Seite Speck', 'Teigwarentasche', 'Salami klein', 'Zopf']);
    expect(titles(4)).toEqual([
      'Vorderschinken',
      '1/2 Schüfeli',
      'Rippli',
      'Wein',
      'Grosser Früchtekorb',
    ]);
  });

  it('asks one row for the four prizes and a full card for the Superlotto', () => {
    for (const prize of EVENT_PRIZE_LIST) {
      expect(prize.winCondition.kind).toBe(prize.slot === 5 ? 'FULL_CARD' : 'ONE_LINE');
    }
  });

  it('holds only valid prizes, each at its own position', () => {
    for (const prize of EVENT_PRIZE_LIST) {
      const draft = {
        title: prize.title,
        description: '',
        valueChf: undefined,
        sponsor: '',
        imageId: undefined,
        winCondition: prize.winCondition,
      };
      expect(validatePrize(draft)).toEqual([]);
    }
    expect(new Set(EVENT_PRIZE_LIST.map((prize) => prize.id)).size).toBe(101);
  });
});

describe('an event starting with the list (ADR-0028)', () => {
  const stores = () => ({
    documents: new MemoryDocumentStore(),
    events: new MemoryEventStore((text: string) => webCrypto.sha256Hex(text)),
  });

  it('fills a new event and stores the list once', async () => {
    const { app, platform } = await createTestHost({ initialPrizes: EVENT_PRIZE_LIST });
    const session = app.session.value;
    expect(session?.catalogue.value.prizes).toHaveLength(101);
    await app.queue.flush();
    expect(await platform.documents.getCatalogue(session?.matchId ?? '')).toMatchObject({
      version: 1,
      prizes: EVENT_PRIZE_LIST,
    });
  });

  it('fills an event that nothing has happened in yet, without an audit entry', async () => {
    const shared = stores();
    await createTestHost(shared);
    const later = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    expect(later.app.session.value?.catalogue.value.prizes).toHaveLength(101);
    await later.app.queue.flush();
    const matchId = later.app.session.value?.matchId ?? '';
    expect(await shared.events.load(matchId)).toEqual([]);
  });

  it('fills an event created in the app', async () => {
    const { admin, app } = await createTestHost({ initialPrizes: EVENT_PRIZE_LIST });
    expect((await admin.create('Zweiter Anlass')).ok).toBe(true);
    expect(app.session.value?.match.value.settings.name).toBe('Zweiter Anlass');
    expect(app.session.value?.catalogue.value.prizes).toHaveLength(101);
  });

  it('keeps the prizes of an event that has any, also after changes to them', async () => {
    const shared = stores();
    const first = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    const session = first.app.session.value;
    if (session === undefined) throw new Error('no session');
    const left = session.catalogue.value.prizes.slice(0, 1);
    expect(session.updateCatalogue({ prizes: left }, 'ROUND_CLEARED', [1]).ok).toBe(true);
    await first.app.queue.flush();
    const later = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    expect(later.app.session.value?.catalogue.value.prizes).toEqual(left);
  });

  it('fills an event being played, keeps its game and records the change', async () => {
    const shared = stores();
    const first = await createTestHost(shared);
    expect(first.host.startRound().ok).toBe(true);
    expect(first.host.drawManual(7).ok).toBe(true);
    expect(first.host.award({ winners: [{ cardNo: '1' }] }).ok).toBe(true);
    await first.app.queue.flush();
    const later = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    const session = later.app.session.value;
    if (session === undefined) throw new Error('no session');
    expect(session.catalogue.value.prizes).toHaveLength(101);
    expect(session.game.value.phase).toBe('ROUND_RUNNING');
    const round = session.game.value.rounds.get(1);
    expect(round?.prizes[1].award?.prize.title).toBeUndefined();
    expect(activePrizeView(session.game.value, session.catalogue.value, DEFAULTS)).toMatchObject({
      slot: 2,
      prize: { title: 'Teigwarentasche' },
    });
    await later.app.queue.flush();
    const log = await shared.events.load(session.matchId);
    expect(log.at(-1)).toMatchObject({
      event: { type: 'PRIZES_CHANGED', action: 'PRIZE_LIST_ADDED' },
    });
    const again = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    expect(again.app.phase.value.kind).toBe('READY');
    await again.app.queue.flush();
    expect(await shared.events.load(session.matchId)).toHaveLength(log.length);
  });

  it('adds no Superlotto to a round that started without one', async () => {
    const shared = stores();
    const first = await createTestHost(shared);
    expect(first.host.jumpToRound(4, 'Testlauf').ok).toBe(true);
    await first.app.queue.flush();
    const later = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    const prizes = later.app.session.value?.catalogue.value.prizes ?? [];
    expect(prizes).toHaveLength(100);
    expect(prizes.filter((prize) => prize.slot === 5).map((prize) => prize.round)).toEqual([
      9, 14, 19, 24,
    ]);
    expect(prizes.filter((prize) => prize.round === 4)).toHaveLength(4);
  });

  it('leaves an event that is over alone', async () => {
    const shared = stores();
    const first = await createTestHost(shared);
    expect(first.host.completeEvent().ok).toBe(true);
    await first.app.queue.flush();
    const later = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    expect(later.app.session.value?.catalogue.value.prizes).toEqual([]);
  });

  it('takes only the rounds the event has', async () => {
    const shared = stores();
    const first = await createTestHost(shared);
    const match = first.app.session.value?.match.value;
    if (match === undefined) throw new Error('no match');
    const settings = { ...match.settings, rounds: 2 };
    await shared.documents.putMatch({ ...match, settings });
    const later = await createTestHost({ ...shared, initialPrizes: EVENT_PRIZE_LIST });
    expect(later.app.session.value?.catalogue.value.prizes).toHaveLength(8);
  });

  it('writes nothing from a window without control', async () => {
    const shared = stores();
    const first = await createTestHost(shared);
    const matchId = first.app.session.value?.matchId ?? '';
    const reader = new AppStore(createTestPlatform({ ...shared, initialPrizes: EVENT_PRIZE_LIST }));
    await reader.boot('display');
    expect(reader.session.value?.catalogue.value.prizes).toEqual([]);
    expect(await shared.documents.getCatalogue(matchId)).toBeUndefined();
  });
});
