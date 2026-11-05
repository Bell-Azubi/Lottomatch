import type { CommandResult } from '../domain/commands';
import { checkEvent } from '../domain/check';
import { applyEnvelope } from '../domain/reducer';
import { initialGameState, type GameState } from '../domain/state';
import type { LogEnvelope, LogEvent, RoundRules } from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';

export const RULES: RoundRules = { maxNumber: 90, perLine: 5, lines: 3, boardReset: 'ROUND' };
export const PRIZE_RULES: RoundRules = { ...RULES, boardReset: 'PRIZE' };
export const CONTEXT = { totalRounds: 24, rules: RULES } as const;

/** Wraps an event in an envelope at the next log position. */
export function envelopeFor(
  state: GameState,
  event: LogEvent,
  at = '2026-11-07T18:00:00.000Z',
): LogEnvelope {
  return {
    id: `e${state.lastLogSeq + 1}`,
    matchId: 'm1',
    seq: state.lastLogSeq + 1,
    at,
    schemaVersion: SCHEMA_VERSION,
    event,
  };
}

/** Applies events after checking each one; throws with the error code when a check fails. */
export function apply(state: GameState, events: readonly LogEvent[]): GameState {
  let next = state;
  for (const event of events) {
    const check = checkEvent(next, event);
    if (!check.ok) throw new Error(`check failed: ${check.error.code}`);
    next = applyEnvelope(next, envelopeFor(next, event));
  }
  return next;
}

/** Applies a successful command result; throws with the error code otherwise. */
export function run(state: GameState, result: CommandResult): GameState {
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return apply(state, result.value);
}

/** Builds the log produced by applying events from the initial state. */
export function logOf(events: readonly LogEvent[]): LogEnvelope[] {
  const log: LogEnvelope[] = [];
  let state = initialGameState();
  for (const event of events) {
    const envelope = envelopeFor(state, event);
    log.push(envelope);
    state = applyEnvelope(state, envelope);
  }
  return log;
}

/** State with round 1 running under the given rules. */
export function startedState(rules: RoundRules = RULES, round = 1): GameState {
  return apply(initialGameState(), [{ type: 'ROUND_STARTED', round, rules }]);
}

/** Draws the given numbers manually in the running round. */
export function drawAll(state: GameState, numbers: readonly number[]): GameState {
  let next = state;
  for (const number of numbers) {
    const round = next.currentRound ?? 1;
    const seq = (next.rounds.get(round)?.draws.length ?? 0) + 1;
    next = apply(next, [{ type: 'NUMBER_DRAWN', round, draw: { seq, number, method: 'MANUAL' } }]);
  }
  return next;
}

/** A deterministic uint32 source that replays the given values in a loop. */
export function sequenceSource(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

/** Seeded SplitMix32-style generator for reproducible large samples. */
export function seededSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}
