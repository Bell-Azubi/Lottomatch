import { cleanText, isIntegerInRange, LIMITS } from './limits';
import type { GameState } from './state';
import type { BoardReset, PrizeSlot, RoundRules, WinCondition } from './types';
import { textLength, validateWinCondition } from './win-condition';

export type LateClaimPolicy = 'ALLOW' | 'REJECT' | 'HOST_DECIDES';
export type TiePolicy = 'TIEBREAK' | 'SHARE';
export type TiebreakOrder = 'HIGHEST' | 'LOWEST';

/** Win-condition template, one condition per slot. */
export type ConditionTemplate = Readonly<Record<PrizeSlot, WinCondition>>;

/** Payout-ratio indicator (Could): prize value against stakes; off by default. */
export interface PayoutSettings {
  readonly enabled: boolean;
  readonly stakesChf?: number;
  readonly minRatioPercent: number;
}

/** Event configuration, edited on the settings page. */
export interface MatchSettings {
  readonly name: string;
  /** ISO date `yyyy-MM-dd`, or empty when not set. */
  readonly date: string;
  readonly venue: string;
  readonly rounds: number;
  readonly maxNumber: number;
  readonly perLine: number;
  readonly lines: number;
  readonly template: ConditionTemplate;
  readonly lateClaimPolicy: LateClaimPolicy;
  readonly tiePolicy: TiePolicy;
  readonly tiebreakOrder: TiebreakOrder;
  readonly boardReset: BoardReset;
  readonly showNamesOnDisplay: boolean;
  readonly sponsors: readonly string[];
  readonly payout: PayoutSettings;
}

export const DEFAULT_TEMPLATE: ConditionTemplate = {
  1: { kind: 'ONE_LINE' },
  2: { kind: 'ONE_LINE' },
  3: { kind: 'ONE_LINE' },
  4: { kind: 'FULL_CARD' },
};

/** Defaults for a new event (24 rounds, 1–90, 3 × 5 cards). */
export function defaultSettings(name: string, date = ''): MatchSettings {
  return {
    name,
    date,
    venue: '',
    rounds: 24,
    maxNumber: 90,
    perLine: 5,
    lines: 3,
    template: DEFAULT_TEMPLATE,
    lateClaimPolicy: 'HOST_DECIDES',
    tiePolicy: 'TIEBREAK',
    tiebreakOrder: 'HIGHEST',
    boardReset: 'ROUND',
    showNamesOnDisplay: false,
    sponsors: [],
    payout: { enabled: false, minRatioPercent: 50 },
  };
}

/** Rules frozen into `ROUND_STARTED`. */
export function rulesOf(settings: MatchSettings): RoundRules {
  return {
    maxNumber: settings.maxNumber,
    perLine: settings.perLine,
    lines: settings.lines,
    boardReset: settings.boardReset,
  };
}

export type SettingsField =
  | 'name'
  | 'date'
  | 'venue'
  | 'rounds'
  | 'maxNumber'
  | 'perLine'
  | 'lines'
  | 'cardSize'
  | 'boardReset'
  | 'template'
  | 'sponsors'
  | 'payout';

export type SettingsIssueCode =
  | 'REQUIRED'
  | 'TOO_LONG'
  | 'INVALID_DATE'
  | 'OUT_OF_RANGE'
  | 'CARD_TOO_LARGE'
  | 'INVALID_CONDITION'
  | 'TOO_MANY'
  | 'LOCKED_WHILE_RUNNING'
  | 'BELOW_PLAYED_ROUND';

export interface SettingsIssue {
  readonly field: SettingsField;
  readonly code: SettingsIssueCode;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for an existing calendar date in `yyyy-MM-dd` form. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function checkText(
  field: SettingsField,
  value: string,
  max: number,
  required: boolean,
): SettingsIssue[] {
  const text = cleanText(value);
  if (required && text === '') return [{ field, code: 'REQUIRED' }];
  if (textLength(text) > max) return [{ field, code: 'TOO_LONG' }];
  return [];
}

/** Validates settings in isolation; returns every issue found. */
export function validateSettings(settings: MatchSettings): readonly SettingsIssue[] {
  const issues: SettingsIssue[] = [
    ...checkText('name', settings.name, LIMITS.matchName, true),
    ...checkText('venue', settings.venue, LIMITS.venue, false),
  ];
  if (settings.date !== '' && !isIsoDate(settings.date))
    issues.push({ field: 'date', code: 'INVALID_DATE' });
  const ranges: readonly [SettingsField, number, { min: number; max: number }][] = [
    ['rounds', settings.rounds, LIMITS.rounds],
    ['maxNumber', settings.maxNumber, LIMITS.maxNumber],
    ['perLine', settings.perLine, LIMITS.perLine],
    ['lines', settings.lines, LIMITS.lines],
  ];
  for (const [field, value, range] of ranges) {
    if (!isIntegerInRange(value, range.min, range.max))
      issues.push({ field, code: 'OUT_OF_RANGE' });
  }
  if (settings.perLine * settings.lines > settings.maxNumber) {
    issues.push({ field: 'cardSize', code: 'CARD_TOO_LARGE' });
  }
  for (const condition of Object.values(settings.template)) {
    if (!validateWinCondition(condition)) {
      issues.push({ field: 'template', code: 'INVALID_CONDITION' });
      break;
    }
  }
  if (settings.sponsors.length > LIMITS.sponsors)
    issues.push({ field: 'sponsors', code: 'TOO_MANY' });
  if (
    settings.sponsors.some((s) => cleanText(s) === '' || textLength(cleanText(s)) > LIMITS.sponsor)
  ) {
    issues.push({ field: 'sponsors', code: 'TOO_LONG' });
  }
  const { payout } = settings;
  const ratioOk = isIntegerInRange(
    payout.minRatioPercent,
    LIMITS.payoutRatio.min,
    LIMITS.payoutRatio.max,
  );
  const stakesOk =
    payout.stakesChf === undefined ||
    (Number.isFinite(payout.stakesChf) &&
      payout.stakesChf >= 0 &&
      payout.stakesChf <= LIMITS.stakesChf.max);
  if (!ratioOk || !stakesOk) issues.push({ field: 'payout', code: 'OUT_OF_RANGE' });
  return issues;
}

/** Highest round number that has ever been started. */
export function highestStartedRound(state: GameState): number {
  let highest = 0;
  for (const round of state.rounds.values()) {
    if (round.runs > 0 && round.round > highest) highest = round.round;
  }
  return highest;
}

/** Checks a settings change against the game state (invariant I6). */
export function checkSettingsChange(
  state: GameState,
  current: MatchSettings,
  next: MatchSettings,
): readonly SettingsIssue[] {
  const issues: SettingsIssue[] = [...validateSettings(next)];
  if (state.phase === 'ROUND_RUNNING') {
    const locked: readonly (keyof MatchSettings & SettingsField)[] = [
      'maxNumber',
      'perLine',
      'lines',
      'boardReset',
    ];
    for (const field of locked) {
      if (current[field] !== next[field]) issues.push({ field, code: 'LOCKED_WHILE_RUNNING' });
    }
  }
  if (next.rounds < highestStartedRound(state))
    issues.push({ field: 'rounds', code: 'BELOW_PLAYED_ROUND' });
  return issues;
}
