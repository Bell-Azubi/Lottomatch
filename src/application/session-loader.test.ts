import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../domain/settings';
import { createTestHost, createTestPlatform } from '../test/test-platform';
import { logOf, RULES } from '../test/domain-builders';
import { AppStore, sortMatches, zurichDate } from './app-store';
import { loadMatch, parseMatches, validateLog } from './loader';
import { buildSnapshot } from './snapshot';
import { isNewer, parseSyncMessage } from './sync-messages';
import { readiness } from './readiness';

describe('MatchSession', () => {
  it('audits settings and catalogue changes only after the event started', async () => {
    const { app, host } = await createTestHost();
    const session = app.session.value;
    if (session === undefined) throw new Error('no session');
    const settings = session.match.value.settings;
    session.updateSettings({ ...settings, venue: 'Halle' }, [
      { field: 'venue', from: '', to: 'Halle' },
    ]);
    expect(session.log).toHaveLength(0);
    host.startRound();
    session.updateSettings({ ...settings, venue: 'Turnhalle' }, [
      { field: 'venue', from: 'Halle', to: 'Turnhalle' },
    ]);
    session.updateCatalogue({ prizes: [] }, 'cleared', [3, 1, 3]);
    expect(session.log.map((e) => e.event.type)).toEqual([
      'ROUND_STARTED',
      'SETTINGS_CHANGED',
      'PRIZES_CHANGED',
    ]);
    const last = session.log.at(-1)?.event;
    expect(last?.type === 'PRIZES_CHANGED' && last.rounds).toEqual([1, 3]);
    expect(session.match.value.settingsVersion).toBe(3);
    expect(session.commit([]).ok).toBe(true);
  });

  it('refuses writes without control', async () => {
    const { app } = await createTestHost();
    app.setWriteGuard(() => false);
    const session = app.session.value;
    expect(session?.commit([{ type: 'PIN_RESET' }])).toEqual({ ok: false, error: 'READ_ONLY' });
    expect(session?.updateRecord({ archived: true }).ok).toBe(false);
    expect(session?.updateCatalogue({ prizes: [] }, 'x', []).ok).toBe(false);
  });
});

describe('loader', () => {
  it('reports corrupt logs with the first bad position', () => {
    const log = logOf([{ type: 'ROUND_STARTED', round: 1, rules: RULES }]);
    expect(validateLog([...log, { nonsense: true }])).toEqual({
      ok: false,
      error: { code: 'LOG_CORRUPT', seq: 2, reason: 'NOT_VERSIONED' },
    });
    const bad = { ...log[0], event: { type: 'UNKNOWN' } };
    expect(validateLog([bad])).toMatchObject({
      ok: false,
      error: { seq: 1, reason: 'INVALID_ENVELOPE' },
    });
    const duplicate = logOf([
      { type: 'ROUND_STARTED', round: 1, rules: RULES },
      { type: 'ROUND_STARTED', round: 2, rules: RULES },
    ]);
    expect(validateLog(duplicate)).toMatchObject({
      ok: false,
      error: { seq: 2, reason: 'ROUND_RUNNING' },
    });
  });

  it('opens the recovery screen for a corrupt catalogue or match list', async () => {
    const platform = createTestPlatform();
    const app = new AppStore(platform);
    app.setWriteGuard(() => true);
    await app.boot('host');
    const match = app.matches.value[0];
    if (match === undefined) throw new Error('no match');
    await platform.documents.putCatalogue({
      matchId: match.id,
      version: 1,
      prizes: [{ bad: 1 }],
    } as never);
    expect(await loadMatch(platform.documents, platform.events, match)).toEqual({
      ok: false,
      error: { code: 'CATALOGUE_CORRUPT' },
    });
    expect(parseMatches([{ id: 1 }, match])).toEqual({ valid: [match], invalid: 1 });
    await platform.documents.putMatch({ id: 'broken' } as never);
    const again = new AppStore(platform);
    await again.boot('host');
    expect(again.phase.value).toEqual({
      kind: 'RECOVERY',
      cause: { code: 'MATCHES_CORRUPT', count: 1 },
    });
  });

  it('sorts events newest first with archived ones last', () => {
    const base = {
      kind: 'REAL' as const,
      updatedAt: '',
      settings: defaultSettings('x'),
      settingsVersion: 1,
    };
    const sorted = sortMatches([
      { ...base, id: 'a', createdAt: '2026-01-01', archived: true },
      { ...base, id: 'b', createdAt: '2026-02-01', archived: false },
      { ...base, id: 'c', createdAt: '2026-03-01', archived: false },
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['c', 'b', 'a']);
    expect(zurichDate('2026-10-25T22:30:00.000Z')).toBe('2026-10-25');
    expect(zurichDate('2026-10-25T23:30:00.000Z')).toBe('2026-10-26');
  });
});

describe('sync messages and snapshots', () => {
  it('validates messages and orders snapshots by (epoch, seq)', async () => {
    const { app } = await createTestHost();
    const session = app.session.value;
    if (session === undefined) throw new Error('no session');
    const snapshot = buildSnapshot({
      epoch: 3,
      seq: 9,
      matchId: session.matchId,
      kind: 'PRACTICE',
      settings: session.match.value.settings,
      catalogue: session.catalogue.value,
      game: session.game.value,
      prefs: app.prefs.value,
      reveal: { key: 'k', durationMs: 800, instant: false },
      overlay: { kind: 'GAME_END', id: 'o1', name: 'Lottomatch' },
    });
    expect(snapshot.practice).toBe(true);
    expect(parseSyncMessage({ t: 'snapshot', snapshot })).toEqual({ t: 'snapshot', snapshot });
    expect(parseSyncMessage({ t: 'snapshot', snapshot: { ...snapshot, v: 2 } })).toBeUndefined();
    expect(parseSyncMessage('garbage')).toBeUndefined();
    expect(isNewer(snapshot, 3, 8)).toBe(true);
    expect(isNewer(snapshot, 3, 9)).toBe(false);
    expect(isNewer(snapshot, 2, 99)).toBe(true);
    expect(isNewer(snapshot, 4, 0)).toBe(false);
  });

  it('builds the readiness checklist', async () => {
    const { app } = await createTestHost();
    const session = app.session.value;
    if (session === undefined) throw new Error('no session');
    const items = readiness({
      settings: { ...session.match.value.settings, rounds: 1 },
      catalogue: session.catalogue.value,
      display: { connected: true, synced: true },
      pwa: {
        supported: true,
        registered: true,
        offlineReady: false,
        updateReady: false,
        failed: false,
      },
      lastBackupAt: '2026-11-07T18:00:00.000Z',
      wakeLockSupported: false,
      persistence: 'BEST_EFFORT',
    });
    expect(items.map((i) => `${i.key}:${i.state}`)).toEqual([
      'prizes:OPEN',
      'display:DONE',
      'offline:OPEN',
      'backup:DONE',
      'wakeLock:UNSUPPORTED',
      'storage:OPEN',
    ]);
    expect(items[0]?.count).toBe(4);
  });
});
