import type {
  DrawMethod,
  HandoutStatus,
  PrizeSlot,
  PrizeSnapshot,
  RoundRules,
  TiebreakDraw,
  Winner,
} from './types';
import { PRIZE_SLOTS, SUPERLOTTO_ROUND_SLOTS, SUPERLOTTO_SLOT } from './types';

export type RoundStatus = 'UPCOMING' | 'RUNNING' | 'COMPLETED' | 'ABORTED';
export type PrizeStatus = 'OPEN' | 'AWARDED' | 'SKIPPED';
export type GamePhase = 'READY' | 'ROUND_RUNNING' | 'BETWEEN_ROUNDS' | 'COMPLETED';

/** A draw as held in state: the slot that was active when it was drawn and its log position. */
export interface DrawEntry {
  readonly seq: number;
  readonly number: number;
  readonly method: DrawMethod;
  readonly slot: PrizeSlot;
  readonly logSeq: number;
  readonly at: string;
}

export interface AwardRecord {
  readonly winners: readonly Winner[];
  readonly prize: PrizeSnapshot;
  readonly claimants?: readonly Winner[];
  readonly tiebreak?: readonly TiebreakDraw[];
  readonly logSeq: number;
  readonly at: string;
  /** Numbers in the active pool when the prize was won ("nach 37 Zahlen"). */
  readonly drawCount: number;
  readonly handout: HandoutStatus;
  readonly corrections: number;
}

export interface PrizeOutcome {
  readonly status: PrizeStatus;
  readonly award?: AwardRecord;
  readonly skipReason?: string;
  /** Log sequence of the award or skip that resolved the prize. */
  readonly resolvedLogSeq?: number;
}

export interface RoundState {
  readonly round: number;
  readonly status: RoundStatus;
  readonly rules?: RoundRules;
  /** Valid draws of the current run of this round, in draw order. */
  readonly draws: readonly DrawEntry[];
  readonly prizes: Readonly<Record<PrizeSlot, PrizeOutcome>>;
  readonly runs: number;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly abortReason?: string;
  readonly rejectedClaims: number;
  readonly revokedAwards: number;
}

export interface GameState {
  readonly phase: GamePhase;
  /** The running round, or the round that ended last. */
  readonly currentRound?: number;
  readonly rounds: ReadonlyMap<number, RoundState>;
  readonly lastLogSeq: number;
  readonly completedAt?: string;
}

const OPEN_PRIZE: PrizeOutcome = { status: 'OPEN' };

/** State of an event before anything happened. */
export function initialGameState(): GameState {
  return { phase: 'READY', rounds: new Map(), lastLogSeq: 0 };
}

/** A round that has never been touched. */
export function emptyRound(round: number): RoundState {
  return {
    round,
    status: 'UPCOMING',
    draws: [],
    prizes: { 1: OPEN_PRIZE, 2: OPEN_PRIZE, 3: OPEN_PRIZE, 4: OPEN_PRIZE, 5: OPEN_PRIZE },
    runs: 0,
    rejectedClaims: 0,
    revokedAwards: 0,
  };
}

/** Round state, falling back to an untouched round. */
export function roundOf(state: GameState, round: number): RoundState {
  return state.rounds.get(round) ?? emptyRound(round);
}

/** The running round, if any. */
export function runningRound(state: GameState): RoundState | undefined {
  if (state.phase !== 'ROUND_RUNNING' || state.currentRound === undefined) return undefined;
  return state.rounds.get(state.currentRound);
}

/** The prizes a round plays: the four, plus the Superlotto when it started with one. */
export function slotsOfRound(round: RoundState): readonly PrizeSlot[] {
  return round.rules?.superlotto === true ? SUPERLOTTO_ROUND_SLOTS : PRIZE_SLOTS;
}

/** First unresolved slot of a round (I2: prizes resolve in slot order). */
export function firstOpenSlot(round: RoundState): PrizeSlot | undefined {
  return slotsOfRound(round).find((slot) => round.prizes[slot].status === 'OPEN');
}

/** The prize that is currently being played for. */
export function activeSlot(state: GameState): PrizeSlot | undefined {
  const round = runningRound(state);
  return round === undefined ? undefined : firstOpenSlot(round);
}

/**
 * Draws that form the pool of a slot under the round's board-reset rule. The Superlotto never gets
 * a board of its own: it goes on with the numbers of the fourth prize (ADR-0027).
 */
export function poolDraws(round: RoundState, slot: PrizeSlot): readonly DrawEntry[] {
  if (round.rules?.boardReset !== 'PRIZE') return round.draws;
  const continued = slot === SUPERLOTTO_SLOT ? 4 : slot;
  return round.draws.filter((d) => d.slot === slot || d.slot === continued);
}

export interface ActivePool {
  readonly round: RoundState;
  readonly slot: PrizeSlot;
  readonly rules: RoundRules;
  readonly draws: readonly DrawEntry[];
}

/** The pool numbers are currently drawn into: the round, or the round and prize. */
export function activePool(state: GameState): ActivePool | undefined {
  const round = runningRound(state);
  if (round?.rules === undefined) return undefined;
  const slot = firstOpenSlot(round);
  if (slot === undefined) return undefined;
  return { round, slot, rules: round.rules, draws: poolDraws(round, slot) };
}

/** Numbers still available in the active pool, ascending. */
export function remainingNumbers(pool: ActivePool): number[] {
  const drawn = new Set(pool.draws.map((d) => d.number));
  const remaining: number[] = [];
  for (let n = 1; n <= pool.rules.maxNumber; n += 1) {
    if (!drawn.has(n)) remaining.push(n);
  }
  return remaining;
}

/** Highest resolved slot of a round, which is always the latest resolution (I2). */
export function latestResolvedSlot(round: RoundState): PrizeSlot | undefined {
  return slotsOfRound(round).findLast((slot) => round.prizes[slot].status !== 'OPEN');
}

/** Log sequence of the latest award or skip in a round, or 0. */
export function latestResolutionLogSeq(round: RoundState): number {
  const slot = latestResolvedSlot(round);
  return slot === undefined ? 0 : (round.prizes[slot].resolvedLogSeq ?? 0);
}

/** True when every prize of the round is awarded or skipped. */
export function isRoundResolved(round: RoundState): boolean {
  return slotsOfRound(round).every((slot) => round.prizes[slot].status !== 'OPEN');
}

/** True when any prize in the round has been resolved. */
export function hasResolution(round: RoundState): boolean {
  return slotsOfRound(round).some((slot) => round.prizes[slot].status !== 'OPEN');
}
