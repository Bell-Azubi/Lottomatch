import { conditionFor, prizeAt, type Catalogue } from '../domain/catalogue';
import { applyEnvelope } from '../domain/reducer';
import type { MatchSettings } from '../domain/settings';
import {
  activePool,
  initialGameState,
  roundOf,
  type AwardRecord,
  type GameState,
  type PrizeStatus,
  type RoundState,
  type RoundStatus,
} from '../domain/state';
import type { HandoutStatus, LogEnvelope, PrizeSlot, WinCondition, Winner } from '../domain/types';
import { slotsForRound } from './selectors';

/** A winner of an awarded prize, with the draw that completed the checked claim. */
export interface WinnerResult {
  readonly cardNo: string | undefined;
  readonly name: string | undefined;
  readonly note: string | undefined;
  readonly validSinceSeq: number | undefined;
  readonly validSinceNumber: number | undefined;
  /** The claim was already complete before the latest draw when the prize was confirmed. */
  readonly late: boolean;
}

export interface TiebreakPass {
  readonly pass: number;
  readonly draws: readonly { readonly claimant: number; readonly number: number }[];
}

export interface TiebreakResult {
  readonly claimants: readonly Winner[];
  readonly passes: readonly TiebreakPass[];
  /** Index of the winning claimant when its card number identifies it unambiguously. */
  readonly winner: number | undefined;
}

export interface PrizeResult {
  readonly slot: PrizeSlot;
  readonly status: PrizeStatus;
  readonly title: string | undefined;
  readonly condition: WinCondition;
  readonly valueChf: number | undefined;
  readonly sponsor: string | undefined;
  readonly winners: readonly WinnerResult[];
  readonly drawCount: number | undefined;
  readonly awardedAt: string | undefined;
  readonly handout: HandoutStatus | undefined;
  readonly corrections: number;
  readonly tiebreak: TiebreakResult | undefined;
  readonly skipReason: string | undefined;
}

export interface RoundSummary {
  readonly round: number;
  readonly status: RoundStatus;
  readonly startedAt: string | undefined;
  readonly endedAt: string | undefined;
  /** From UTC instants, so a DST change during the round cannot distort it. */
  readonly durationMs: number | undefined;
  readonly runs: number;
  readonly abortReason: string | undefined;
  /** Valid draws of the current (or last) run of the round. */
  readonly draws: number;
  readonly falseClaims: number;
  readonly revokedAwards: number;
  readonly prizes: readonly PrizeResult[];
}

export interface ResultsTotals {
  readonly rounds: number;
  readonly roundsCompleted: number;
  readonly roundsAborted: number;
  readonly roundsRunning: number;
  readonly roundsUpcoming: number;
  readonly prizesAwarded: number;
  readonly prizesSkipped: number;
  readonly prizesOpen: number;
  readonly winners: number;
  readonly handedOut: number;
  readonly valueAwardedChf: number;
  /** Every number drawn during the event, minus undone draws (all runs of all rounds). */
  readonly draws: number;
  readonly falseClaims: number;
}

export interface EventResults {
  readonly rounds: readonly RoundSummary[];
  readonly totals: ResultsTotals;
}

export interface ResultsInput {
  readonly game: GameState;
  readonly log: readonly LogEnvelope[];
  readonly catalogue: Catalogue;
  readonly settings: MatchSettings;
}

interface AwardMoment {
  readonly latestSeq: number | undefined;
  /** Draw position → number in the active pool when the prize was confirmed. */
  readonly numbers: ReadonlyMap<number, number>;
}

interface LogFacts {
  readonly moments: ReadonlyMap<number, AwardMoment>;
  readonly falseClaims: ReadonlyMap<number, number>;
  readonly revoked: ReadonlyMap<number, number>;
  readonly netDraws: number;
}

function increment(counts: Map<number, number>, key: number): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** Replays the log once to recover facts the final state no longer holds. */
function scanLog(log: readonly LogEnvelope[]): LogFacts {
  let state = initialGameState();
  const moments = new Map<number, AwardMoment>();
  const falseClaims = new Map<number, number>();
  const revoked = new Map<number, number>();
  let netDraws = 0;
  for (const envelope of log) {
    const { event } = envelope;
    switch (event.type) {
      case 'PRIZE_AWARDED': {
        const draws = activePool(state)?.draws ?? [];
        const numbers = new Map(draws.map((draw) => [draw.seq, draw.number] as const));
        moments.set(envelope.seq, { latestSeq: draws.at(-1)?.seq, numbers });
        break;
      }
      case 'NUMBER_DRAWN':
        netDraws += 1;
        break;
      case 'DRAW_UNDONE':
        netDraws -= 1;
        break;
      case 'CLAIM_REJECTED':
        increment(falseClaims, event.round);
        break;
      case 'AWARD_REVOKED':
        increment(revoked, event.round);
        break;
      default:
        break;
    }
    state = applyEnvelope(state, envelope);
  }
  return { moments, falseClaims, revoked, netDraws };
}

function winnerResult(winner: Winner, moment: AwardMoment | undefined): WinnerResult {
  const since = winner.validSinceSeq;
  const latest = moment?.latestSeq;
  return {
    cardNo: winner.cardNo,
    name: winner.name,
    note: winner.note,
    validSinceSeq: since,
    validSinceNumber: since === undefined ? undefined : moment?.numbers.get(since),
    late: since !== undefined && latest !== undefined && since < latest,
  };
}

function tiebreakResult(award: AwardRecord): TiebreakResult | undefined {
  const { tiebreak, claimants } = award;
  if (tiebreak === undefined || claimants === undefined) return undefined;
  const passes = new Map<number, { claimant: number; number: number }[]>();
  for (const draw of tiebreak) {
    const list = passes.get(draw.pass) ?? [];
    list.push({ claimant: draw.claimant, number: draw.number });
    passes.set(draw.pass, list);
  }
  const card = award.winners[0]?.cardNo;
  const matches = claimants.flatMap((claimant, index) =>
    card !== undefined && claimant.cardNo === card ? [index] : [],
  );
  return {
    claimants,
    passes: [...passes.entries()]
      .sort(([a], [b]) => a - b)
      .map(([pass, draws]) => ({ pass, draws })),
    winner: matches.length === 1 ? matches[0] : undefined,
  };
}

function prizeResult(
  round: RoundState,
  slot: PrizeSlot,
  input: ResultsInput,
  facts: LogFacts,
): PrizeResult {
  const outcome = round.prizes[slot];
  const { award } = outcome;
  if (award !== undefined) {
    const moment = facts.moments.get(award.logSeq);
    return {
      slot,
      status: outcome.status,
      title: award.prize.title,
      condition: award.prize.winCondition,
      valueChf: award.prize.valueChf,
      sponsor: award.prize.sponsor,
      winners: award.winners.map((winner) => winnerResult(winner, moment)),
      drawCount: award.drawCount,
      awardedAt: award.at,
      handout: award.handout,
      corrections: award.corrections,
      tiebreak: tiebreakResult(award),
      skipReason: undefined,
    };
  }
  const prize = prizeAt(input.catalogue, round.round, slot);
  return {
    slot,
    status: outcome.status,
    title: prize?.title,
    condition: conditionFor(input.catalogue, input.settings.template, round.round, slot),
    valueChf: prize?.valueChf,
    sponsor: prize?.sponsor,
    winners: [],
    drawCount: undefined,
    awardedAt: undefined,
    handout: undefined,
    corrections: 0,
    tiebreak: undefined,
    skipReason: outcome.skipReason,
  };
}

function durationOf(
  startedAt: string | undefined,
  endedAt: string | undefined,
): number | undefined {
  if (startedAt === undefined || endedAt === undefined) return undefined;
  const duration = Date.parse(endedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}

function summariseRound(number: number, input: ResultsInput, facts: LogFacts): RoundSummary {
  const round = roundOf(input.game, number);
  return {
    round: number,
    status: round.status,
    startedAt: round.startedAt,
    endedAt: round.endedAt,
    durationMs: durationOf(round.startedAt, round.endedAt),
    runs: round.runs,
    abortReason: round.abortReason,
    draws: round.draws.length,
    falseClaims: facts.falseClaims.get(number) ?? 0,
    revokedAwards: facts.revoked.get(number) ?? 0,
    prizes: slotsForRound(round, input.catalogue).map((slot) =>
      prizeResult(round, slot, input, facts),
    ),
  };
}

function totalsOf(rounds: readonly RoundSummary[], facts: LogFacts): ResultsTotals {
  const prizes = rounds.flatMap((round) => round.prizes);
  const awarded = prizes.filter((prize) => prize.status === 'AWARDED');
  const countRounds = (status: RoundStatus) =>
    rounds.filter((round) => round.status === status).length;
  const rappen = awarded.reduce((sum, prize) => sum + Math.round((prize.valueChf ?? 0) * 100), 0);
  return {
    rounds: rounds.length,
    roundsCompleted: countRounds('COMPLETED'),
    roundsAborted: countRounds('ABORTED'),
    roundsRunning: countRounds('RUNNING'),
    roundsUpcoming: countRounds('UPCOMING'),
    prizesAwarded: awarded.length,
    prizesSkipped: prizes.filter((prize) => prize.status === 'SKIPPED').length,
    prizesOpen: prizes.filter((prize) => prize.status === 'OPEN').length,
    winners: awarded.reduce((sum, prize) => sum + prize.winners.length, 0),
    handedOut: awarded.filter((prize) => prize.handout === 'COLLECTED').length,
    valueAwardedChf: rappen / 100,
    draws: facts.netDraws,
    falseClaims: [...facts.falseClaims.values()].reduce((sum, count) => sum + count, 0),
  };
}

/** Per-round results and event totals for the Auswertung page (FR-11). */
export function computeResults(input: ResultsInput): EventResults {
  const facts = scanLog(input.log);
  const lastRound = Math.max(input.settings.rounds, ...input.game.rounds.keys());
  const rounds = Array.from({ length: lastRound }, (_, index) =>
    summariseRound(index + 1, input, facts),
  );
  return { rounds, totals: totalsOf(rounds, facts) };
}
