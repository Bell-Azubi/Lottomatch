import { checkEvent } from './check';
import type { DomainError } from './errors';
import { err, ok, type Result } from './result';
import {
  emptyRound,
  firstOpenSlot,
  hasResolution,
  initialGameState,
  isRoundResolved,
  poolDraws,
  roundOf,
  type GameState,
  type PrizeOutcome,
  type RoundState,
} from './state';
import type { GameEvent, LogEnvelope, PrizeSlot } from './types';

function withRound(state: GameState, round: RoundState, patch: Partial<GameState> = {}): GameState {
  const rounds = new Map(state.rounds);
  rounds.set(round.round, round);
  return { ...state, ...patch, rounds };
}

function withPrize(round: RoundState, slot: PrizeSlot, outcome: PrizeOutcome): RoundState {
  return { ...round, prizes: { ...round.prizes, [slot]: outcome } };
}

/** After an award or skip: completes the round when every prize is resolved. */
function settleRound(state: GameState, round: RoundState, at: string): GameState {
  if (!isRoundResolved(round)) return withRound(state, round);
  return withRound(
    state,
    { ...round, status: 'COMPLETED', endedAt: at },
    { phase: 'BETWEEN_ROUNDS' },
  );
}

function applyGameEvent(state: GameState, event: GameEvent, logSeq: number, at: string): GameState {
  switch (event.type) {
    case 'ROUND_STARTED': {
      const previous = state.rounds.get(event.round) ?? emptyRound(event.round);
      const { endedAt: _ended, abortReason: _abort, ...rest } = previous;
      const round: RoundState = {
        ...rest,
        status: 'RUNNING',
        rules: event.rules,
        draws: [],
        runs: previous.runs + 1,
        startedAt: previous.startedAt ?? at,
      };
      return withRound(state, round, { phase: 'ROUND_RUNNING', currentRound: event.round });
    }
    case 'NUMBER_DRAWN': {
      const round = roundOf(state, event.round);
      const slot = firstOpenSlot(round) ?? 1;
      const entry = { ...event.draw, slot, logSeq, at };
      return withRound(state, { ...round, draws: [...round.draws, entry] });
    }
    case 'DRAW_UNDONE': {
      const round = roundOf(state, event.round);
      return withRound(state, { ...round, draws: round.draws.slice(0, -1) });
    }
    case 'CLAIM_REJECTED': {
      const round = roundOf(state, event.round);
      return withRound(state, { ...round, rejectedClaims: round.rejectedClaims + 1 });
    }
    case 'PRIZE_AWARDED': {
      const round = roundOf(state, event.round);
      const award = {
        winners: event.winners,
        prize: event.prize,
        ...(event.claimants === undefined ? {} : { claimants: event.claimants }),
        ...(event.tiebreak === undefined ? {} : { tiebreak: event.tiebreak }),
        logSeq,
        at,
        drawCount: poolDraws(round, event.slot).length,
        handout: 'OPEN' as const,
        corrections: 0,
      };
      const outcome: PrizeOutcome = { status: 'AWARDED', award, resolvedLogSeq: logSeq };
      return settleRound(state, withPrize(round, event.slot, outcome), at);
    }
    case 'PRIZE_SKIPPED': {
      const round = roundOf(state, event.round);
      const outcome: PrizeOutcome = {
        status: 'SKIPPED',
        skipReason: event.reason,
        resolvedLogSeq: logSeq,
      };
      return settleRound(state, withPrize(round, event.slot, outcome), at);
    }
    case 'AWARD_REVOKED': {
      const round = roundOf(state, event.round);
      const { endedAt: _ended, ...rest } = withPrize(round, event.slot, { status: 'OPEN' });
      const reopened: RoundState = {
        ...rest,
        status: 'RUNNING',
        revokedAwards: round.revokedAwards + 1,
      };
      return withRound(state, reopened, { phase: 'ROUND_RUNNING' });
    }
    case 'ROUND_ABORTED': {
      const round = roundOf(state, event.round);
      if (round.draws.length === 0 && !hasResolution(round)) {
        return withRound(state, emptyRound(event.round), { phase: 'BETWEEN_ROUNDS' });
      }
      const aborted: RoundState = {
        ...round,
        status: 'ABORTED',
        endedAt: at,
        abortReason: event.reason,
      };
      return withRound(state, aborted, { phase: 'BETWEEN_ROUNDS' });
    }
    case 'WINNER_CORRECTED': {
      const round = roundOf(state, event.round);
      const outcome = round.prizes[event.slot];
      if (outcome.award === undefined) return state;
      const award = {
        ...outcome.award,
        winners: event.winners,
        corrections: outcome.award.corrections + 1,
      };
      return withRound(state, withPrize(round, event.slot, { ...outcome, award }));
    }
    case 'HANDOUT_CHANGED': {
      const round = roundOf(state, event.round);
      const outcome = round.prizes[event.slot];
      if (outcome.award === undefined) return state;
      const award = { ...outcome.award, handout: event.status };
      return withRound(state, withPrize(round, event.slot, { ...outcome, award }));
    }
    case 'EVENT_COMPLETED':
      return { ...state, phase: 'COMPLETED', completedAt: at };
  }
}

/**
 * Applies one envelope to the state. Pure; assumes the event passed {@link checkEvent}.
 * Audit-only events advance the log position without changing the game.
 */
export function applyEnvelope(state: GameState, envelope: LogEnvelope): GameState {
  const { event, seq, at } = envelope;
  switch (event.type) {
    case 'SETTINGS_CHANGED':
    case 'PRIZES_CHANGED':
    case 'PIN_RESET':
    case 'PERSONAL_DATA_ERASED':
    case 'CONTROL_TAKEN_OVER':
      return { ...state, lastLogSeq: seq };
    default:
      return { ...applyGameEvent(state, event, seq, at), lastLogSeq: seq };
  }
}

export interface ReplayError {
  /** Log sequence of the first envelope that could not be applied. */
  readonly seq: number;
  readonly cause: DomainError | { readonly code: 'SEQUENCE_GAP' };
}

/**
 * Rebuilds the state from a persisted log, verifying ordering (I7) and every invariant.
 * A failure means the stored log is corrupt and the recovery screen must open.
 */
export function replay(log: readonly LogEnvelope[]): Result<GameState, ReplayError> {
  let state = initialGameState();
  for (const envelope of log) {
    if (envelope.seq !== state.lastLogSeq + 1) {
      return err({ seq: envelope.seq, cause: { code: 'SEQUENCE_GAP' } });
    }
    const check = checkEvent(state, envelope.event);
    if (!check.ok) return err({ seq: envelope.seq, cause: check.error });
    state = applyEnvelope(state, envelope);
  }
  return ok(state);
}
