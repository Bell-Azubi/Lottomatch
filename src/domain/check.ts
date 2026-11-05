import { domainError, type DomainError } from './errors';
import { cleanText, isIntegerInRange, LIMITS } from './limits';
import { err, ok, type Result } from './result';
import {
  activePool,
  type ActivePool,
  latestResolutionLogSeq,
  latestResolvedSlot,
  roundOf,
  runningRound,
  type GameState,
} from './state';
import type { GameEvent, LogEvent, PrizeSlot, RoundRules, TiebreakDraw, Winner } from './types';
import { validateWinCondition, textLength } from './win-condition';

type Check = Result<void, DomainError>;
const PASS: Check = ok(undefined);

function fail(code: DomainError['code'], details: Omit<DomainError, 'code'> = {}): Check {
  return err(domainError(code, details));
}

/** True when the rules are within the configurable ranges and the card fits the pool. */
export function validRules(rules: RoundRules): boolean {
  return (
    isIntegerInRange(rules.maxNumber, LIMITS.maxNumber.min, LIMITS.maxNumber.max) &&
    isIntegerInRange(rules.perLine, LIMITS.perLine.min, LIMITS.perLine.max) &&
    isIntegerInRange(rules.lines, LIMITS.lines.min, LIMITS.lines.max) &&
    rules.perLine * rules.lines <= rules.maxNumber
  );
}

/** True for a non-empty reason of at most 200 characters. */
export function validReason(reason: string): boolean {
  const text = cleanText(reason);
  return text !== '' && textLength(text) <= LIMITS.reason;
}

function optionalTextOk(value: string | undefined, max: number): boolean {
  return value === undefined || textLength(value) <= max;
}

/** True when a winner record is well formed. */
export function validWinner(winner: Winner): boolean {
  return (
    optionalTextOk(winner.cardNo, LIMITS.cardNo) &&
    optionalTextOk(winner.name, LIMITS.winnerName) &&
    optionalTextOk(winner.note, LIMITS.winnerNote) &&
    (winner.validSinceSeq === undefined || isIntegerInRange(winner.validSinceSeq, 1, 10_000))
  );
}

function validWinners(winners: readonly Winner[]): boolean {
  return winners.length >= 1 && winners.length <= LIMITS.maxWinners && winners.every(validWinner);
}

/** Structural check of Stechen draws: indices, numbers and passes in range. */
export function validTiebreak(
  draws: readonly TiebreakDraw[],
  claimantCount: number,
  maxNumber: number,
): boolean {
  if (claimantCount < 2 || draws.length < claimantCount) return false;
  return draws.every(
    (d) =>
      isIntegerInRange(d.claimant, 0, claimantCount - 1) &&
      isIntegerInRange(d.number, 1, maxNumber) &&
      isIntegerInRange(d.pass, 1, 1_000),
  );
}

function checkRunning(state: GameState, round: number): Result<ActivePool, DomainError> {
  if (state.phase === 'COMPLETED') return err(domainError('EVENT_COMPLETED'));
  const running = runningRound(state);
  if (running === undefined) return err(domainError('NO_ROUND_RUNNING'));
  if (running.round !== round) return err(domainError('ROUND_MISMATCH', { round }));
  const pool = activePool(state);
  if (pool === undefined) return err(domainError('NO_ROUND_RUNNING'));
  return ok(pool);
}

function checkSlot(state: GameState, round: number, slot: PrizeSlot): Check {
  const pool = checkRunning(state, round);
  if (!pool.ok) return pool;
  return pool.value.slot === slot ? PASS : fail('SLOT_MISMATCH');
}

function checkRoundStart(
  state: GameState,
  event: Extract<GameEvent, { type: 'ROUND_STARTED' }>,
): Check {
  if (state.phase === 'COMPLETED') return fail('EVENT_COMPLETED');
  if (state.phase === 'ROUND_RUNNING') return fail('ROUND_RUNNING');
  if (!isIntegerInRange(event.round, LIMITS.rounds.min, LIMITS.rounds.max)) {
    return fail('ROUND_OUT_OF_RANGE', { round: event.round });
  }
  if (roundOf(state, event.round).status === 'COMPLETED') {
    return fail('ROUND_ALREADY_COMPLETED', { round: event.round });
  }
  if (!validRules(event.rules)) return fail('INVALID_RULES');
  if (event.reason !== undefined && !validReason(event.reason)) return fail('REASON_REQUIRED');
  return PASS;
}

function checkDraw(state: GameState, event: Extract<GameEvent, { type: 'NUMBER_DRAWN' }>): Check {
  const pool = checkRunning(state, event.round);
  if (!pool.ok) return pool;
  const { number, seq } = event.draw;
  if (!isIntegerInRange(number, 1, pool.value.rules.maxNumber))
    return fail('NUMBER_OUT_OF_RANGE', { number });
  if (pool.value.draws.some((d) => d.number === number))
    return fail('NUMBER_ALREADY_DRAWN', { number });
  if (seq !== pool.value.round.draws.length + 1) return fail('SEQUENCE_MISMATCH');
  return PASS;
}

function checkUndo(state: GameState, event: Extract<GameEvent, { type: 'DRAW_UNDONE' }>): Check {
  const pool = checkRunning(state, event.round);
  if (!pool.ok) return pool;
  const { round } = pool.value;
  const last = round.draws.at(-1);
  if (last === undefined) return fail('NOTHING_TO_UNDO');
  if (last.logSeq < latestResolutionLogSeq(round)) return fail('UNDO_BLOCKED');
  return last.seq === event.seq ? PASS : fail('SEQUENCE_MISMATCH');
}

function checkClaimRejected(
  state: GameState,
  event: Extract<GameEvent, { type: 'CLAIM_REJECTED' }>,
): Check {
  const slotCheck = checkSlot(state, event.round, event.slot);
  if (!slotCheck.ok) return slotCheck;
  const max = roundOf(state, event.round).rules?.maxNumber ?? 0;
  const inRange = (n: number): boolean => isIntegerInRange(n, 1, max);
  const late = event.lateSinceSeq;
  const valid =
    event.claimed.length <= max &&
    new Set(event.claimed).size === event.claimed.length &&
    event.claimed.every(inRange) &&
    event.missing.every((n) => inRange(n) && event.claimed.includes(n)) &&
    (late === undefined ? event.missing.length > 0 : isIntegerInRange(late, 1, 10_000));
  return valid ? PASS : fail('INVALID_CLAIM');
}

function checkAward(state: GameState, event: Extract<GameEvent, { type: 'PRIZE_AWARDED' }>): Check {
  const slotCheck = checkSlot(state, event.round, event.slot);
  if (!slotCheck.ok) return slotCheck;
  if (!validWinners(event.winners) || !validateWinCondition(event.prize.winCondition)) {
    return fail('INVALID_WINNERS');
  }
  if (event.tiebreak === undefined)
    return event.claimants === undefined ? PASS : fail('INVALID_TIEBREAK');
  const claimants = event.claimants ?? [];
  const max = roundOf(state, event.round).rules?.maxNumber ?? 0;
  const valid =
    event.winners.length === 1 &&
    claimants.every(validWinner) &&
    validTiebreak(event.tiebreak, claimants.length, max);
  return valid ? PASS : fail('INVALID_TIEBREAK');
}

function checkRevoke(
  state: GameState,
  event: Extract<GameEvent, { type: 'AWARD_REVOKED' }>,
): Check {
  if (state.phase === 'COMPLETED') return fail('EVENT_COMPLETED');
  if (!validReason(event.reason)) return fail('REASON_REQUIRED');
  if (state.currentRound !== event.round) return fail('NO_AWARD_TO_REVOKE');
  const round = roundOf(state, event.round);
  if (round.status !== 'RUNNING' && round.status !== 'COMPLETED') return fail('NO_AWARD_TO_REVOKE');
  const latest = latestResolvedSlot(round);
  const outcome = latest === undefined ? undefined : round.prizes[latest];
  if (latest !== event.slot || outcome?.status !== 'AWARDED') return fail('NO_AWARD_TO_REVOKE');
  if (round.rules?.boardReset === 'PRIZE') {
    const resolvedAt = outcome.resolvedLogSeq ?? 0;
    if (round.draws.some((d) => d.logSeq > resolvedAt)) return fail('REVOKE_BLOCKED_BY_DRAWS');
  }
  return PASS;
}

function checkCorrection(
  state: GameState,
  event: Extract<GameEvent, { type: 'WINNER_CORRECTED' }>,
): Check {
  const outcome = roundOf(state, event.round).prizes[event.slot];
  if (outcome.status !== 'AWARDED' || outcome.award === undefined) return fail('PRIZE_NOT_AWARDED');
  if (!validWinners(event.winners)) return fail('INVALID_WINNERS');
  if (event.winners.length !== outcome.award.winners.length) return fail('WINNER_COUNT_MISMATCH');
  return textLength(event.reason) <= LIMITS.reason ? PASS : fail('REASON_REQUIRED');
}

function checkHandout(
  state: GameState,
  event: Extract<GameEvent, { type: 'HANDOUT_CHANGED' }>,
): Check {
  const outcome = roundOf(state, event.round).prizes[event.slot];
  return outcome.status === 'AWARDED' ? PASS : fail('PRIZE_NOT_AWARDED');
}

function checkGameEvent(state: GameState, event: GameEvent): Check {
  switch (event.type) {
    case 'ROUND_STARTED':
      return checkRoundStart(state, event);
    case 'NUMBER_DRAWN':
      return checkDraw(state, event);
    case 'DRAW_UNDONE':
      return checkUndo(state, event);
    case 'CLAIM_REJECTED':
      return checkClaimRejected(state, event);
    case 'PRIZE_AWARDED':
      return checkAward(state, event);
    case 'AWARD_REVOKED':
      return checkRevoke(state, event);
    case 'PRIZE_SKIPPED':
      return validReason(event.reason)
        ? checkSlot(state, event.round, event.slot)
        : fail('REASON_REQUIRED');
    case 'ROUND_ABORTED': {
      if (!validReason(event.reason)) return fail('REASON_REQUIRED');
      const running = checkRunning(state, event.round);
      return running.ok ? PASS : running;
    }
    case 'WINNER_CORRECTED':
      return checkCorrection(state, event);
    case 'HANDOUT_CHANGED':
      return checkHandout(state, event);
    case 'EVENT_COMPLETED':
      if (state.phase === 'COMPLETED') return fail('EVENT_COMPLETED');
      return state.phase === 'ROUND_RUNNING' ? fail('ROUND_RUNNING') : PASS;
  }
}

/**
 * Single source of truth for the invariants a log event must satisfy against the state it is
 * applied to. Commands use it before appending; replay uses it to detect corrupt logs.
 */
export function checkEvent(state: GameState, event: LogEvent): Check {
  switch (event.type) {
    case 'SETTINGS_CHANGED':
    case 'PRIZES_CHANGED':
    case 'PIN_RESET':
    case 'PERSONAL_DATA_ERASED':
    case 'CONTROL_TAKEN_OVER':
      return PASS;
    default:
      return checkGameEvent(state, event);
  }
}
