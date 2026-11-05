import { describe, expect, it } from 'vitest';
import { createTestHost, type TestHost } from '../test/test-platform';
import type { MatchSession } from './session';
import { parseCatalogue, parseEnvelope } from './schemas';
import { validEventName } from './match-admin';

function sessionOf(host: TestHost): MatchSession {
  const session = host.app.session.value;
  if (session === undefined) throw new Error('no active session');
  return session;
}

async function readOnlyHost(first: TestHost): Promise<TestHost> {
  return createTestHost({
    documents: first.platform.documents,
    events: first.platform.events,
    images: first.platform.images,
    lock: {
      acquire: () => Promise.resolve('HELD_ELSEWHERE'),
      steal: () => Promise.resolve(),
      release: () => undefined,
    },
  });
}

function addPrize(host: TestHost): void {
  const session = sessionOf(host);
  session.updateCatalogue(
    {
      prizes: [
        { id: 'p1', round: 1, slot: 1, title: 'Präsentkorb', winCondition: { kind: 'ONE_LINE' } },
      ],
    },
    'TEST',
    [1],
  );
}

function playAward(host: TestHost, name: string): void {
  expect(host.host.startRound().ok).toBe(true);
  expect(host.host.spin().ok).toBe(true);
  expect(host.host.award({ winners: [{ cardNo: '12', name, note: 'Tisch 3' }] }).ok).toBe(true);
}

describe('validEventName', () => {
  it('cleans names and rejects empty or overlong ones', () => {
    expect(validEventName('  Herbst   Lotto ')).toBe('Herbst Lotto');
    expect(validEventName('   ')).toBeUndefined();
    expect(validEventName('x'.repeat(81))).toBeUndefined();
  });
});

describe('MatchAdmin', () => {
  it('creates an event with default settings and switches to it', async () => {
    const test = await createTestHost();
    const result = await test.admin.create(' Frühlingslotto ');
    expect(result.ok).toBe(true);
    expect(test.app.matches.value).toHaveLength(2);
    expect(sessionOf(test).match.value.settings.name).toBe('Frühlingslotto');
    expect(sessionOf(test).match.value.settings.rounds).toBe(24);
    expect(await test.platform.documents.getMeta('activeMatchId')).toBe(sessionOf(test).matchId);
  });

  it('rejects invalid names', async () => {
    const test = await createTestHost();
    expect(await test.admin.create('  ')).toEqual({ ok: false, error: 'INVALID_NAME' });
    expect(await test.admin.startPractice('')).toEqual({ ok: false, error: 'INVALID_NAME' });
    const id = sessionOf(test).matchId;
    expect(await test.admin.duplicate(id, 'x'.repeat(81))).toEqual({
      ok: false,
      error: 'INVALID_NAME',
    });
    expect(await test.admin.duplicate('missing', 'Kopie')).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('duplicates settings and prizes with new ids, without draws or winners', async () => {
    const test = await createTestHost();
    addPrize(test);
    playAward(test, 'Anna');
    const source = sessionOf(test).matchId;
    const result = await test.admin.duplicate(source, 'Vorlage');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copy = result.value;
    expect(copy.settings.name).toBe('Vorlage');
    expect(copy.settings.date).toBe('');
    expect(copy.sourceMatchId).toBe(source);
    expect(sessionOf(test).matchId).toBe(source);
    const catalogue = parseCatalogue(await test.platform.documents.getCatalogue(copy.id));
    expect(catalogue?.prizes.map((p) => p.title)).toEqual(['Präsentkorb']);
    expect(catalogue?.prizes[0]?.id).not.toBe('p1');
    expect(await test.platform.events.load(copy.id)).toEqual([]);
  });

  it('starts a separate practice event from the active event', async () => {
    const test = await createTestHost();
    addPrize(test);
    const source = sessionOf(test).matchId;
    const result = await test.admin.startPractice('Übung – Lottomatch');
    expect(result.ok).toBe(true);
    const practice = sessionOf(test).match.value;
    expect(practice.kind).toBe('PRACTICE');
    expect(practice.sourceMatchId).toBe(source);
    expect(sessionOf(test).catalogue.value.prizes).toHaveLength(1);
    expect(sessionOf(test).log).toHaveLength(0);
  });

  it('archives inactive events only and restores them on switch', async () => {
    const test = await createTestHost();
    const first = sessionOf(test).matchId;
    await test.admin.create('Zweiter Anlass');
    expect(await test.admin.setArchived(sessionOf(test).matchId, true)).toEqual({
      ok: false,
      error: 'ACTIVE_EVENT',
    });
    expect(await test.admin.setArchived('missing', true)).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect((await test.admin.setArchived(first, true)).ok).toBe(true);
    expect(test.app.matches.value.at(-1)?.archived).toBe(true);
    expect((await test.admin.switchTo(first)).ok).toBe(true);
    expect(sessionOf(test).match.value.archived).toBe(false);
    expect(await test.admin.switchTo('missing')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('resets the active event but keeps settings and prizes', async () => {
    const test = await createTestHost();
    addPrize(test);
    playAward(test, 'Anna');
    expect((await test.admin.resetActive()).ok).toBe(true);
    const session = sessionOf(test);
    expect(session.game.value.phase).toBe('READY');
    expect(session.log).toHaveLength(0);
    expect(session.catalogue.value.prizes).toHaveLength(1);
  });

  it('erases names and notes in every event, keeps the hash chain and logs it', async () => {
    const test = await createTestHost();
    playAward(test, 'Anna Muster');
    const first = sessionOf(test).matchId;
    await test.admin.create('Zweiter Anlass');
    playAward(test, 'Beat Beispiel');
    const result = await test.admin.erasePersonalData();
    expect(result).toEqual({ ok: true, value: 2 });
    await test.app.queue.flush();
    for (const id of [first, sessionOf(test).matchId]) {
      const stored = (await test.platform.events.load(id)).map(parseEnvelope);
      expect(JSON.stringify(stored)).not.toMatch(/Anna|Beat|Tisch/);
      expect(JSON.stringify(stored)).toContain('"cardNo":"12"');
      expect((await test.platform.events.verify(id)).ok).toBe(true);
    }
    expect(sessionOf(test).log.at(-1)?.event).toEqual({ type: 'PERSONAL_DATA_ERASED', winners: 2 });
  });

  it('refuses every change in a read-only window', async () => {
    const first = await createTestHost();
    const second = await readOnlyHost(first);
    const id = sessionOf(first).matchId;
    expect(await second.admin.create('X')).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.admin.duplicate(id, 'X')).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.admin.startPractice('X')).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.admin.switchTo(id)).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.admin.setArchived(id, true)).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.admin.resetActive()).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(await second.admin.erasePersonalData()).toEqual({ ok: false, error: 'READ_ONLY' });
  });
});
