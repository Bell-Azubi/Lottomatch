import { checkEvent, validReason } from './check';
import { domainError, type DomainError } from './errors';
import { cleanText, isIntegerInRange } from './limits';
import { pickUniform, type Uint32Source } from './random';
import { applyEnvelope } from './reducer';
import { err, ok, type Result } from './result';
import { nextRound, roundStatus } from './rounds';
import {
  activePool,
  latestResolvedSlot,
  remainingNumbers,
  roundOf,
  type ActivePool,
  type GameState,
} from './state';
import type {
  HandoutStatus,
  LogEvent,
  PrizeSlot,
  PrizeSnapshot,
  RoundRules,
  TiebreakDraw,
  Winner,
} from './types';
import { SCHEMA_VERSION } from './types';

export type CommandResult = Result<readonly LogEvent[], DomainError>;

/** Settings a command needs beyond the game state. */
export interface RoundContext {
  readonly totalRounds: number;
  readonly rules: RoundRules;
}

/** Validates events in order against a scratch state and returns them unchanged. */
export function emit(state: GameState, events: readonly LogEvent[]): CommandResult {
  let scratch = state;
  for (const event of events) {
    const check = checkEvent(scratch, event);
    if (!check.ok) return check;
    scratch = applyEnvelope(scratch, {
      id: '',
      matchId: '',
      seq: scratch.lastLogSeq + 1,
      at: '',
      schemaVersion: SCHEMA_VERSION,
      event,
    });
  }
  return ok(events);
}

function requirePool(state: GameState): Result<ActivePool, DomainError> {
  if (state.phase === 'COMPLETED') return err(domainError('EVENT_COMPLETED'));
  const pool = activePool(state);
  return pool === undefined ? err(domainError('NO_ROUND_RUNNING')) : ok(pool);
}

/** Draws a uniformly random number from the active pool (FR-2). */
export function drawRandom(state: GameState, next: Uint32Source): CommandResult {
  const pool = requirePool(state);
  if (!pool.ok) return pool;
  const number = pickUniform(remainingNumbers(pool.value), next);
  if (number === undefined) return err(domainError('POOL_EMPTY'));
  const draw = { seq: pool.value.round.draws.length + 1, number, method: 'RANDOM' as const };
  return emit(state, [{ type: 'NUMBER_DRAWN', round: pool.value.round.round, draw }]);
}

/** Records a number drawn from the physical drum (FR-3). */
export function drawManual(state: GameState, number: number): CommandResult {
  const pool = requirePool(state);
  if (!pool.ok) return pool;
  const draw = { seq: pool.value.round.draws.length + 1, number, method: 'MANUAL' as const };
  return emit(state, [{ type: 'NUMBER_DRAWN', round: pool.value.round.round, draw }]);
}

/** Reverts the latest draw if no award or skip followed it (I3). */
export function undoLastDraw(state: GameState): CommandResult {
  const pool = requirePool(state);
  if (!pool.ok) return pool;
  const last = pool.value.round.draws.at(-1);
  if (last === undefined) return err(domainError('NOTHING_TO_UNDO'));
  return emit(state, [{ type: 'DRAW_UNDONE', round: pool.value.round.round, seq: last.seq }]);
}

/** Starts the next round (FR-5 flow, I5). */
export function startNextRound(state: GameState, context: RoundContext): CommandResult {
  if (state.phase === 'COMPLETED') return err(domainError('EVENT_COMPLETED'));
  if (state.phase === 'ROUND_RUNNING') return err(domainError('ROUND_RUNNING'));
  const round = nextRound(state, context.totalRounds);
  if (round === undefined) return err(domainError('NO_ROUND_LEFT'));
  return emit(state, [{ type: 'ROUND_STARTED', round, rules: context.rules }]);
}

/** Host override: jumps to a round, aborting a running round with the same reason. */
export function jumpToRound(
  state: GameState,
  context: RoundContext,
  target: number,
  reason: string,
): CommandResult {
  if (state.phase === 'COMPLETED') return err(domainError('EVENT_COMPLETED'));
  if (!validReason(reason)) return err(domainError('REASON_REQUIRED'));
  if (!isIntegerInRange(target, 1, context.totalRounds)) {
    return err(domainError('ROUND_OUT_OF_RANGE', { round: target }));
  }
  const status = roundStatus(state, target);
  if (status === 'COMPLETED') return err(domainError('ROUND_ALREADY_COMPLETED', { round: target }));
  if (status === 'RUNNING') return err(domainError('ROUND_RUNNING'));
  const text = cleanText(reason);
  const events: LogEvent[] = [];
  if (state.phase === 'ROUND_RUNNING' && state.currentRound !== undefined) {
    events.push({ type: 'ROUND_ABORTED', round: state.currentRound, reason: text });
  }
  events.push({ type: 'ROUND_STARTED', round: target, rules: context.rules, reason: text });
  return emit(state, events);
}

/** Host override: aborts the running round. */
export function abortRound(state: GameState, reason: string): CommandResult {
  const pool = requirePool(state);
  if (!pool.ok) return pool;
  return emit(state, [
    { type: 'ROUND_ABORTED', round: pool.value.round.round, reason: cleanText(reason) },
  ]);
}

/** Closes the event; afterwards only winner corrections and handouts are possible. */
export function completeEvent(state: GameState): CommandResult {
  return emit(state, [{ type: 'EVENT_COMPLETED' }]);
}

export interface AwardInput {
  readonly winners: readonly Winner[];
  readonly prize: PrizeSnapshot;
  readonly claimants?: readonly Winner[];
  readonly tiebreak?: readonly TiebreakDraw[];
}

/** Confirms the active prize (Gewinn bestätigen). */
export function awardPrize(state: GameState, input: AwardInput): CommandResult {
  const pool = requirePool(state);
  if (!pool.ok) return pool;
  return emit(state, [
    {
      type: 'PRIZE_AWARDED',
      round: pool.value.round.round,
      slot: pool.value.slot,
      winners: input.winners,
      prize: input.prize,
      ...(input.claimants === undefined ? {} : { claimants: input.claimants }),
      ...(input.tiebreak === undefined ? {} : { tiebreak: input.tiebreak }),
    },
  ]);
}

/** Records a false claim (Fehlmeldung) or a rejected late claim; play continues. */
export function rejectClaim(
  state: GameState,
  claimed: readonly number[],
  missing: readonly number[],
  lateSinceSeq?: number,
): CommandResult {
  const pool = requirePool(state);
  if (!pool.ok) return pool;
  return emit(state, [
    {
      type: 'CLAIM_REJECTED',
      round: pool.value.round.round,
      slot: pool.value.slot,
      claimed,
      missing,
      ...(lateSinceSeq === undefined ? {} : { lateSinceSeq }),
    },
  ]);
}

/** Revokes the latest award of the current round; its prize becomes active again (I4). */
export function revokeLatestAward(state: GameState, reason: string): CommandResult {
  if (state.phase === 'COMPLETED') return err(domainError('EVENT_COMPLETED'));
  if (state.currentRound === undefined) return err(domainError('NO_AWARD_TO_REVOKE'));
  const slot = latestResolvedSlot(roundOf(state, state.currentRound));
  if (slot === undefined) return err(domainError('NO_AWARD_TO_REVOKE'));
  return emit(state, [
    { type: 'AWARD_REVOKED', round: state.currentRound, slot, reason: cleanText(reason) },
  ]);
}

/** Host override: skips the active prize. */
export function skipPrize(state: GameState, reason: string): CommandResult {
  const pool = requirePool(state);
  if (!pool.ok) return pool;
  return emit(state, [
    {
      type: 'PRIZE_SKIPPED',
      round: pool.value.round.round,
      slot: pool.value.slot,
      reason: cleanText(reason),
    },
  ]);
}

/** Corrects winner details of an earlier award; never changes who won. */
export function correctWinners(
  state: GameState,
  round: number,
  slot: PrizeSlot,
  winners: readonly Winner[],
  reason: string,
): CommandResult {
  return emit(state, [
    { type: 'WINNER_CORRECTED', round, slot, winners, reason: cleanText(reason) },
  ]);
}

/** Marks an awarded prize as handed out or open again (Gabentisch). */
export function setHandout(
  state: GameState,
  round: number,
  slot: PrizeSlot,
  status: HandoutStatus,
): CommandResult {
  return emit(state, [{ type: 'HANDOUT_CHANGED', round, slot, status }]);
}
