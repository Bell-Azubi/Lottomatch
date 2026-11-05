import { parseChf } from '../../../domain/money';
import type {
  LateClaimPolicy,
  MatchSettings,
  SettingsField,
  SettingsIssue,
  TiebreakOrder,
  TiePolicy,
} from '../../../domain/settings';
import type { PrizeSlot, WinCondition, WinConditionKind } from '../../../domain/types';
import type { SettingsMessages } from '../../../i18n/de-CH/settings';

export interface ConditionDraft {
  readonly kind: WinConditionKind;
  readonly label: string;
}

/** Form state of the event settings: numbers stay strings while the user types. */
export interface EventDraft {
  readonly name: string;
  readonly date: string;
  readonly venue: string;
  readonly rounds: string;
  readonly maxNumber: string;
  readonly perLine: string;
  readonly lines: string;
  readonly template: Readonly<Record<PrizeSlot, ConditionDraft>>;
  readonly lateClaimPolicy: LateClaimPolicy;
  readonly tiePolicy: TiePolicy;
  readonly tiebreakOrder: TiebreakOrder;
  readonly prizeReset: boolean;
  readonly showNamesOnDisplay: boolean;
  readonly sponsors: string;
  readonly payoutEnabled: boolean;
  readonly stakes: string;
  readonly minRatio: string;
}

function conditionDraft(condition: WinCondition): ConditionDraft {
  return { kind: condition.kind, label: condition.kind === 'CUSTOM' ? condition.label : '' };
}

function conditionFromDraft(draft: ConditionDraft): WinCondition {
  return draft.kind === 'CUSTOM' ? { kind: 'CUSTOM', label: draft.label } : { kind: draft.kind };
}

/** CHF value as typed back into the form (`4500`, `4500.50`). */
function plainChf(value: number | undefined): string {
  if (value === undefined) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Whole numbers only; anything else becomes NaN, which validation reports as out of range. */
export function parseWholeNumber(value: string): number {
  const text = value.trim();
  return /^\d{1,6}$/.test(text) ? Number(text) : Number.NaN;
}

export function draftFromSettings(settings: MatchSettings): EventDraft {
  return {
    name: settings.name,
    date: settings.date,
    venue: settings.venue,
    rounds: String(settings.rounds),
    maxNumber: String(settings.maxNumber),
    perLine: String(settings.perLine),
    lines: String(settings.lines),
    template: {
      1: conditionDraft(settings.template[1]),
      2: conditionDraft(settings.template[2]),
      3: conditionDraft(settings.template[3]),
      4: conditionDraft(settings.template[4]),
    },
    lateClaimPolicy: settings.lateClaimPolicy,
    tiePolicy: settings.tiePolicy,
    tiebreakOrder: settings.tiebreakOrder,
    prizeReset: settings.boardReset === 'PRIZE',
    showNamesOnDisplay: settings.showNamesOnDisplay,
    sponsors: settings.sponsors.join('\n'),
    payoutEnabled: settings.payout.enabled,
    stakes: plainChf(settings.payout.stakesChf),
    minRatio: String(settings.payout.minRatioPercent),
  };
}

interface DraftConversion {
  readonly settings: MatchSettings;
  /** Problems the settings model cannot express, e.g. an unparseable CHF amount. */
  readonly issues: readonly SettingsIssue[];
}

/** Converts the form back into settings; the domain validates the result. */
export function settingsFromDraft(draft: EventDraft, base: MatchSettings): DraftConversion {
  const stakes = parseChf(draft.stakes);
  const issues: SettingsIssue[] = stakes.ok ? [] : [{ field: 'payout', code: 'OUT_OF_RANGE' }];
  const stakesChf = stakes.ok ? stakes.value : undefined;
  return {
    settings: {
      ...base,
      name: draft.name,
      date: draft.date,
      venue: draft.venue,
      rounds: parseWholeNumber(draft.rounds),
      maxNumber: parseWholeNumber(draft.maxNumber),
      perLine: parseWholeNumber(draft.perLine),
      lines: parseWholeNumber(draft.lines),
      template: {
        1: conditionFromDraft(draft.template[1]),
        2: conditionFromDraft(draft.template[2]),
        3: conditionFromDraft(draft.template[3]),
        4: conditionFromDraft(draft.template[4]),
      },
      lateClaimPolicy: draft.lateClaimPolicy,
      tiePolicy: draft.tiePolicy,
      tiebreakOrder: draft.tiebreakOrder,
      boardReset: draft.prizeReset ? 'PRIZE' : 'ROUND',
      showNamesOnDisplay: draft.showNamesOnDisplay,
      sponsors: draft.sponsors.split(/\r?\n/),
      payout: {
        enabled: draft.payoutEnabled,
        minRatioPercent: parseWholeNumber(draft.minRatio),
        ...(stakesChf === undefined ? {} : { stakesChf }),
      },
    },
    issues,
  };
}

/** Message for one validation issue, saying what is wrong and what is allowed. */
export function issueText(issue: SettingsIssue, m: SettingsMessages, minRounds: number): string {
  const locked = issue.code === 'LOCKED_WHILE_RUNNING';
  switch (issue.field) {
    case 'name':
      return issue.code === 'TOO_LONG' ? m.issues.name.TOO_LONG : m.issues.name.REQUIRED;
    case 'venue':
      return m.issues.venue.TOO_LONG;
    case 'date':
      return m.issues.date.INVALID_DATE;
    case 'rounds':
      return issue.code === 'BELOW_PLAYED_ROUND'
        ? m.issues.belowPlayed(minRounds)
        : m.issues.rounds.OUT_OF_RANGE;
    case 'maxNumber':
      return locked ? m.issues.locked : m.issues.maxNumber.OUT_OF_RANGE;
    case 'perLine':
      return locked ? m.issues.locked : m.issues.perLine.OUT_OF_RANGE;
    case 'lines':
      return locked ? m.issues.locked : m.issues.lines.OUT_OF_RANGE;
    case 'cardSize':
      return m.issues.cardSize;
    case 'boardReset':
      return m.issues.locked;
    case 'template':
      return m.issues.template;
    case 'sponsors':
      return issue.code === 'TOO_MANY' ? m.issues.sponsors.TOO_MANY : m.issues.sponsors.TOO_LONG;
    case 'payout':
      return m.issues.payout;
  }
}

/** First message per field, for inline errors. */
export function messagesByField(
  issues: readonly SettingsIssue[],
  m: SettingsMessages,
  minRounds: number,
): Partial<Record<SettingsField, string>> {
  const result: Partial<Record<SettingsField, string>> = {};
  for (const issue of issues) result[issue.field] ??= issueText(issue, m, minRounds);
  return result;
}
