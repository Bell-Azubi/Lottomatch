import { cleanText } from '../domain/limits';
import { chfToPlain } from '../domain/money';
import { err, ok, type Result } from '../domain/result';
import { checkSettingsChange, type MatchSettings, type SettingsIssue } from '../domain/settings';
import type { AuditChange, WinCondition } from '../domain/types';
import { PRIZE_SLOTS } from '../domain/types';
import type { AppStore } from './app-store';
import type { BuildInfo, DiagnosticEntry, StorageBackend } from './platform';
import type { StoragePersistence } from './ports';
import type { PwaStatus } from './pwa';
import type { MatchRecord, Preferences } from './records';

/** Audit values are clipped so a single change never bloats the log. */
const MAX_AUDIT_VALUE = 400;

function clip(value: string): string {
  const chars = Array.from(value);
  return chars.length <= MAX_AUDIT_VALUE
    ? value
    : `${chars.slice(0, MAX_AUDIT_VALUE - 1).join('')}…`;
}

function conditionValue(condition: WinCondition): string {
  return condition.kind === 'CUSTOM' ? `CUSTOM: ${condition.label}` : condition.kind;
}

function stakesValue(stakes: number | undefined): string {
  return stakes === undefined ? '' : chfToPlain(stakes);
}

/**
 * Readable, language-neutral diff of two settings documents for the audit log: field keys and
 * plain values (numbers, codes, CHF as `1000.50`), so any UI language can render it later.
 */
export function diffSettings(before: MatchSettings, after: MatchSettings): readonly AuditChange[] {
  const changes: AuditChange[] = [];
  const add = (field: string, from: string, to: string) => {
    if (from !== to) changes.push({ field, from: clip(from), to: clip(to) });
  };
  add('name', before.name, after.name);
  add('date', before.date, after.date);
  add('venue', before.venue, after.venue);
  for (const key of ['rounds', 'maxNumber', 'perLine', 'lines'] as const) {
    add(key, String(before[key]), String(after[key]));
  }
  for (const slot of PRIZE_SLOTS) {
    add(
      `template.${slot}`,
      conditionValue(before.template[slot]),
      conditionValue(after.template[slot]),
    );
  }
  add('lateClaimPolicy', before.lateClaimPolicy, after.lateClaimPolicy);
  add('tiePolicy', before.tiePolicy, after.tiePolicy);
  add('tiebreakOrder', before.tiebreakOrder, after.tiebreakOrder);
  add('boardReset', before.boardReset, after.boardReset);
  add('showNamesOnDisplay', String(before.showNamesOnDisplay), String(after.showNamesOnDisplay));
  add('sponsors', before.sponsors.join(', '), after.sponsors.join(', '));
  add('payout.enabled', String(before.payout.enabled), String(after.payout.enabled));
  add(
    'payout.stakesChf',
    stakesValue(before.payout.stakesChf),
    stakesValue(after.payout.stakesChf),
  );
  add(
    'payout.minRatioPercent',
    String(before.payout.minRatioPercent),
    String(after.payout.minRatioPercent),
  );
  return changes;
}

function cleanCondition(condition: WinCondition): WinCondition {
  return condition.kind === 'CUSTOM'
    ? { kind: 'CUSTOM', label: cleanText(condition.label) }
    : condition;
}

/** Trims free text, cleans custom rule labels and drops empty sponsor lines. */
export function normaliseSettings(settings: MatchSettings): MatchSettings {
  return {
    ...settings,
    name: cleanText(settings.name),
    venue: cleanText(settings.venue),
    template: {
      1: cleanCondition(settings.template[1]),
      2: cleanCondition(settings.template[2]),
      3: cleanCondition(settings.template[3]),
      4: cleanCondition(settings.template[4]),
    },
    sponsors: settings.sponsors.map(cleanText).filter((sponsor) => sponsor !== ''),
  };
}

type ApplyError = readonly SettingsIssue[] | 'READ_ONLY';

/**
 * Validates (including invariant I6 against the running round) and saves the settings of the
 * active event. Changes after the event started are written to the audit log.
 */
export function applySettings(
  app: AppStore,
  next: MatchSettings,
): Result<{ readonly changes: number }, ApplyError> {
  const session = app.session.value;
  if (session === undefined || !app.canWrite()) return err('READ_ONLY');
  const current = session.match.value.settings;
  const normalised = normaliseSettings(next);
  const issues = checkSettingsChange(session.game.value, current, normalised);
  if (issues.length > 0) return err(issues);
  const changes = diffSettings(current, normalised);
  if (changes.length === 0) return ok({ changes: 0 });
  if (!session.updateSettings(normalised, changes).ok) return err('READ_ONLY');
  app.upsertMatchInList(session.match.value);
  return ok({ changes: changes.length });
}

interface DiagnosticsInput {
  readonly generatedAt: string;
  readonly build: BuildInfo;
  readonly userAgent: string;
  readonly language: string;
  readonly backend: StorageBackend;
  readonly persistence: StoragePersistence;
  readonly storage: { readonly usage: number; readonly quota: number } | undefined;
  readonly pwa: PwaStatus;
  readonly prefs: Preferences;
  readonly matches: readonly MatchRecord[];
  readonly active:
    | {
        readonly kind: MatchRecord['kind'];
        readonly phase: string;
        readonly rounds: number;
        readonly logEntries: number;
        readonly settingsVersion: number;
      }
    | undefined;
  readonly errors: readonly DiagnosticEntry[];
}

/**
 * Diagnostics export (Einstellungen → Über). Technical facts only: no event names, no winner
 * names, no notes — nothing personal leaves the device through this file (C6).
 */
export function buildDiagnostics(input: DiagnosticsInput) {
  return {
    format: 'lottomatch-live-diagnostics',
    version: 1,
    generatedAt: input.generatedAt,
    app: { version: input.build.version, commit: input.build.commit, buildDate: input.build.date },
    environment: {
      userAgent: input.userAgent,
      language: input.language,
      backend: input.backend,
      persistence: input.persistence,
      storage: input.storage ?? null,
    },
    serviceWorker: input.pwa,
    preferences: input.prefs,
    events: {
      total: input.matches.length,
      practice: input.matches.filter((match) => match.kind === 'PRACTICE').length,
      archived: input.matches.filter((match) => match.archived).length,
    },
    active: input.active ?? null,
    errors: input.errors,
  };
}
