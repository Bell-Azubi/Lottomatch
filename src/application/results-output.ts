import type { MatchSettings } from '../domain/settings';
import type { HandoutStatus, PrizeSlot, WinCondition } from '../domain/types';
import type { MatchKind } from './records';
import type { EventResults, ResultsTotals, RoundSummary } from './results';

export type RoundFilter = 'PLAYED' | 'ALL';

/** Rounds to show: played ones (anything but upcoming) or all; optionally only open handouts. */
export function filterRounds(
  rounds: readonly RoundSummary[],
  filter: RoundFilter,
  openHandoutsOnly: boolean,
): RoundSummary[] {
  return rounds
    .filter((round) => filter === 'ALL' || round.status !== 'UPCOMING')
    .map((round) =>
      openHandoutsOnly
        ? { ...round, prizes: round.prizes.filter((prize) => prize.handout === 'OPEN') }
        : round,
    )
    .filter((round) => !openHandoutsOnly || round.prizes.length > 0);
}

/** One row per winning card, for the CSV export and the Gabentisch list. */
export interface WinnerRow {
  readonly round: number;
  readonly slot: PrizeSlot;
  readonly title: string | undefined;
  readonly condition: WinCondition;
  readonly valueChf: number | undefined;
  readonly sponsor: string | undefined;
  readonly cardNo: string | undefined;
  readonly name: string | undefined;
  readonly note: string | undefined;
  readonly drawCount: number | undefined;
  readonly awardedAt: string | undefined;
  readonly handout: HandoutStatus | undefined;
  readonly shared: boolean;
  readonly tiebreak: boolean;
  readonly late: boolean;
}

export function winnerRows(rounds: readonly RoundSummary[]): WinnerRow[] {
  return rounds.flatMap((round) =>
    round.prizes
      .filter((prize) => prize.status === 'AWARDED')
      .flatMap((prize) =>
        prize.winners.map((winner) => ({
          round: round.round,
          slot: prize.slot,
          title: prize.title,
          condition: prize.condition,
          valueChf: prize.valueChf,
          sponsor: prize.sponsor,
          cardNo: winner.cardNo,
          name: winner.name,
          note: winner.note,
          drawCount: prize.drawCount,
          awardedAt: prize.awardedAt,
          handout: prize.handout,
          shared: prize.winners.length > 1,
          tiebreak: prize.tiebreak !== undefined,
          late: winner.late,
        })),
      ),
  );
}

export const RESULTS_FORMAT = 'lottomatch-live-results' as const;

/** Structured JSON export of the results; names appear only where they were entered (C6). */
export interface ResultsDocument {
  readonly format: typeof RESULTS_FORMAT;
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly event: {
    readonly name: string;
    readonly date: string;
    readonly venue: string;
    readonly kind: MatchKind;
    readonly rounds: number;
  };
  readonly totals: ResultsTotals;
  readonly rounds: readonly RoundSummary[];
}

export function resultsDocument(
  results: EventResults,
  settings: MatchSettings,
  kind: MatchKind,
  exportedAt: string,
): ResultsDocument {
  return {
    format: RESULTS_FORMAT,
    schemaVersion: 1,
    exportedAt,
    event: {
      name: settings.name,
      date: settings.date,
      venue: settings.venue,
      kind,
      rounds: settings.rounds,
    },
    totals: results.totals,
    rounds: results.rounds,
  };
}
