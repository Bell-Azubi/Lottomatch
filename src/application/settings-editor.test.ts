import { describe, expect, it } from 'vitest';
import { defaultSettings, type MatchSettings } from '../domain/settings';
import { createTestHost, type TestHost } from '../test/test-platform';
import type { AppStore } from './app-store';
import { PwaState } from './pwa';
import { DEFAULT_PREFERENCES } from './records';
import {
  applySettings,
  buildDiagnostics,
  diffSettings,
  normaliseSettings,
} from './settings-editor';

const base = defaultSettings('Lottomatch', '2026-11-07');

function settingsOf(app: AppStore): MatchSettings {
  const session = app.session.value;
  if (session === undefined) throw new Error('no active session');
  return session.match.value.settings;
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

describe('diffSettings', () => {
  it('reports nothing for equal settings', () => {
    expect(diffSettings(base, base)).toEqual([]);
  });

  it('lists every changed field with plain, language-neutral values', () => {
    const next: MatchSettings = {
      ...base,
      name: 'Herbst',
      date: '2026-11-14',
      venue: 'Turnhalle',
      rounds: 20,
      maxNumber: 75,
      perLine: 4,
      lines: 2,
      template: { ...base.template, 2: { kind: 'CUSTOM', label: 'Ecken' } },
      lateClaimPolicy: 'REJECT',
      tiePolicy: 'SHARE',
      tiebreakOrder: 'LOWEST',
      boardReset: 'PRIZE',
      showNamesOnDisplay: true,
      sponsors: ['Bäckerei', 'Garage'],
      payout: { enabled: true, stakesChf: 4500, minRatioPercent: 60 },
    };
    expect(diffSettings(base, next)).toEqual([
      { field: 'name', from: 'Lottomatch', to: 'Herbst' },
      { field: 'date', from: '2026-11-07', to: '2026-11-14' },
      { field: 'venue', from: '', to: 'Turnhalle' },
      { field: 'rounds', from: '24', to: '20' },
      { field: 'maxNumber', from: '90', to: '75' },
      { field: 'perLine', from: '5', to: '4' },
      { field: 'lines', from: '3', to: '2' },
      { field: 'template.2', from: 'ONE_LINE', to: 'CUSTOM: Ecken' },
      { field: 'lateClaimPolicy', from: 'HOST_DECIDES', to: 'REJECT' },
      { field: 'tiePolicy', from: 'TIEBREAK', to: 'SHARE' },
      { field: 'tiebreakOrder', from: 'HIGHEST', to: 'LOWEST' },
      { field: 'boardReset', from: 'ROUND', to: 'PRIZE' },
      { field: 'showNamesOnDisplay', from: 'false', to: 'true' },
      { field: 'sponsors', from: '', to: 'Bäckerei, Garage' },
      { field: 'payout.enabled', from: 'false', to: 'true' },
      { field: 'payout.stakesChf', from: '', to: '4500.00' },
      { field: 'payout.minRatioPercent', from: '50', to: '60' },
    ]);
  });

  it('clips very long values', () => {
    const sponsors = Array.from({ length: 20 }, (_, index) => `Sponsor ${index} ${'x'.repeat(48)}`);
    const [change] = diffSettings(base, { ...base, sponsors });
    expect(Array.from(change?.to ?? '')).toHaveLength(400);
    expect(change?.to.endsWith('…')).toBe(true);
  });
});

describe('normaliseSettings', () => {
  it('trims text, cleans custom labels and drops empty sponsor lines', () => {
    const raw: MatchSettings = {
      ...base,
      name: '  Herbst   Lotto ',
      venue: ' Halle ',
      template: { ...base.template, 4: { kind: 'CUSTOM', label: '  Ecken  ' } },
      sponsors: [' Bäckerei ', '', '   ', 'Garage'],
    };
    const clean = normaliseSettings(raw);
    expect(clean.name).toBe('Herbst Lotto');
    expect(clean.venue).toBe('Halle');
    expect(clean.template[4]).toEqual({ kind: 'CUSTOM', label: 'Ecken' });
    expect(clean.template[1]).toEqual({ kind: 'ONE_LINE' });
    expect(clean.sponsors).toEqual(['Bäckerei', 'Garage']);
  });
});

describe('applySettings', () => {
  it('saves valid settings and updates the event list', async () => {
    const { app } = await createTestHost();
    const result = applySettings(app, { ...settingsOf(app), name: '  Herbstlotto  ' });
    expect(result).toEqual({ ok: true, value: { changes: 1 } });
    expect(settingsOf(app).name).toBe('Herbstlotto');
    expect(app.matches.value[0]?.settings.name).toBe('Herbstlotto');
    expect(app.session.value?.log).toHaveLength(0);
  });

  it('reports an unchanged document without writing', async () => {
    const { app } = await createTestHost();
    const version = app.session.value?.match.value.settingsVersion;
    expect(applySettings(app, settingsOf(app))).toEqual({ ok: true, value: { changes: 0 } });
    expect(app.session.value?.match.value.settingsVersion).toBe(version);
  });

  it('returns field issues', async () => {
    const { app } = await createTestHost();
    const result = applySettings(app, { ...settingsOf(app), rounds: 0, name: ' ' });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error !== 'READ_ONLY') {
      expect(result.error.map((issue) => `${issue.field}:${issue.code}`)).toEqual([
        'name:REQUIRED',
        'rounds:OUT_OF_RANGE',
      ]);
    }
  });

  it('locks N while a round runs and audits changes after the start (I6)', async () => {
    const { app, host } = await createTestHost();
    expect(host.startRound().ok).toBe(true);
    const locked = applySettings(app, { ...settingsOf(app), maxNumber: 75 });
    expect(locked.ok).toBe(false);
    if (!locked.ok && locked.error !== 'READ_ONLY') {
      expect(locked.error).toEqual([{ field: 'maxNumber', code: 'LOCKED_WHILE_RUNNING' }]);
    }
    expect(applySettings(app, { ...settingsOf(app), venue: 'Mehrzweckhalle' }).ok).toBe(true);
    const audit = app.session.value?.log.at(-1)?.event;
    expect(audit).toEqual({
      type: 'SETTINGS_CHANGED',
      changes: [{ field: 'venue', from: '', to: 'Mehrzweckhalle' }],
    });
  });

  it('refuses in a read-only window', async () => {
    const first = await createTestHost();
    const second = await readOnlyHost(first);
    expect(applySettings(second.app, { ...base, name: 'X' })).toEqual({
      ok: false,
      error: 'READ_ONLY',
    });
  });
});

describe('buildDiagnostics', () => {
  it('summarises the device without names', async () => {
    const { app, host, platform } = await createTestHost();
    host.startRound();
    host.spin();
    host.award({ winners: [{ cardNo: '12', name: 'Anna Muster', note: 'Tisch 3' }] });
    const report = buildDiagnostics({
      generatedAt: '2026-11-07T20:00:00.000Z',
      build: platform.build,
      userAgent: 'test-agent',
      language: 'de-CH',
      backend: platform.backend,
      persistence: 'PERSISTED',
      storage: { usage: 10, quota: 100 },
      pwa: new PwaState().status.value,
      prefs: DEFAULT_PREFERENCES,
      matches: app.matches.value,
      active: undefined,
      errors: [{ at: '2026-11-07T19:00:00.000Z', context: 'test', name: 'Error', message: 'boom' }],
    });
    expect(report.events).toEqual({ total: 1, practice: 0, archived: 0 });
    expect(report.app.commit).toBe('test-commit');
    const text = JSON.stringify(report);
    expect(text).not.toContain('Anna');
    expect(text).not.toContain('Lottomatch"');
    expect(report.active).toBeNull();
  });
});
