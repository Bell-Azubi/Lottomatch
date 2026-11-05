import type { LogEnvelope, LogEvent, PrizeSlot, Winner } from '../domain/types';

export type AuditCategory =
  'DRAWS' | 'CLAIMS' | 'CORRECTIONS' | 'OVERRIDES' | 'DOCUMENTS' | 'SYSTEM';

/** Filter order in the audit-log viewer. */
export const AUDIT_CATEGORIES: readonly AuditCategory[] = [
  'DRAWS',
  'CLAIMS',
  'CORRECTIONS',
  'OVERRIDES',
  'DOCUMENTS',
  'SYSTEM',
];

/** One log entry prepared for the viewer; the UI renders the sentence from `event`. */
export interface AuditEntry {
  readonly seq: number;
  readonly at: string;
  readonly category: AuditCategory;
  readonly round: number | undefined;
  readonly event: LogEvent;
  /** DRAW_UNDONE: the number that was undone. */
  readonly undoneNumber: number | undefined;
  /** AWARD_REVOKED: the winners of the award that was revoked. */
  readonly revokedWinners: readonly Winner[] | undefined;
}

/** Category of a log event in the viewer's filter. */
export function categoryOf(event: LogEvent): AuditCategory {
  switch (event.type) {
    case 'NUMBER_DRAWN':
      return 'DRAWS';
    case 'ROUND_STARTED':
      return event.reason === undefined ? 'DRAWS' : 'OVERRIDES';
    case 'PRIZE_AWARDED':
    case 'CLAIM_REJECTED':
    case 'HANDOUT_CHANGED':
      return 'CLAIMS';
    case 'DRAW_UNDONE':
    case 'AWARD_REVOKED':
    case 'WINNER_CORRECTED':
      return 'CORRECTIONS';
    case 'PRIZE_SKIPPED':
    case 'ROUND_ABORTED':
    case 'EVENT_COMPLETED':
      return 'OVERRIDES';
    case 'SETTINGS_CHANGED':
    case 'PRIZES_CHANGED':
      return 'DOCUMENTS';
    case 'PIN_RESET':
    case 'PERSONAL_DATA_ERASED':
    case 'CONTROL_TAKEN_OVER':
      return 'SYSTEM';
  }
}

function roundOfEvent(event: LogEvent): number | undefined {
  return 'round' in event ? event.round : undefined;
}

function prizeKey(round: number, slot: PrizeSlot): string {
  return `${round}-${slot}`;
}

/** Prepares the whole log for the viewer, in log order. */
export function auditEntries(log: readonly LogEnvelope[]): AuditEntry[] {
  const drawn = new Map<number, Map<number, number>>();
  const awards = new Map<string, readonly Winner[]>();
  return log.map(({ seq, at, event }) => {
    let undoneNumber: number | undefined;
    let revokedWinners: readonly Winner[] | undefined;
    switch (event.type) {
      case 'ROUND_STARTED':
        drawn.set(event.round, new Map());
        break;
      case 'NUMBER_DRAWN': {
        const draws = drawn.get(event.round) ?? new Map<number, number>();
        draws.set(event.draw.seq, event.draw.number);
        drawn.set(event.round, draws);
        break;
      }
      case 'DRAW_UNDONE': {
        const draws = drawn.get(event.round);
        undoneNumber = draws?.get(event.seq);
        draws?.delete(event.seq);
        break;
      }
      case 'PRIZE_AWARDED':
      case 'WINNER_CORRECTED':
        awards.set(prizeKey(event.round, event.slot), event.winners);
        break;
      case 'AWARD_REVOKED':
        revokedWinners = awards.get(prizeKey(event.round, event.slot));
        awards.delete(prizeKey(event.round, event.slot));
        break;
      default:
        break;
    }
    return {
      seq,
      at,
      category: categoryOf(event),
      round: roundOfEvent(event),
      event,
      undoneNumber,
      revokedWinners,
    };
  });
}

export interface AuditFilter {
  readonly category: AuditCategory | 'ALL';
  readonly round: number | 'ALL';
}

/** Entries matching the filter, newest first. */
export function filterAudit(entries: readonly AuditEntry[], filter: AuditFilter): AuditEntry[] {
  return entries
    .filter(
      (entry) =>
        (filter.category === 'ALL' || entry.category === filter.category) &&
        (filter.round === 'ALL' || entry.round === filter.round),
    )
    .reverse();
}

/** Rounds that occur in the log, ascending (round filter options). */
export function auditRounds(entries: readonly AuditEntry[]): number[] {
  const rounds = new Set<number>();
  for (const entry of entries) if (entry.round !== undefined) rounds.add(entry.round);
  return [...rounds].sort((a, b) => a - b);
}
