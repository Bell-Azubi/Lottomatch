import { describe, expect, it } from 'vitest';
import { apply, CONTEXT, drawAll, RULES, run, startedState } from '../test/domain-builders';
import { jumpToRound, skipPrize, startNextRound } from './commands';
import { completedRoundCount, nextRound, roundRing, unplayedRounds } from './rounds';
import { initialGameState, type GameState } from './state';

function completeRound(state: GameState): GameState {
  let next = state;
  for (let i = 0; i < 4; i += 1) next = run(next, skipPrize(next, 'leer'));
  return next;
}

describe('nextRound', () => {
  it('starts at round 1 and follows on', () => {
    expect(nextRound(initialGameState(), 24)).toBe(1);
    const done = completeRound(startedState());
    expect(nextRound(done, 24)).toBe(2);
  });

  it('falls back to rounds jumped over', () => {
    let state = run(initialGameState(), jumpToRound(initialGameState(), CONTEXT, 3, 'Start bei 3'));
    state = completeRound(state);
    expect(nextRound(state, 3)).toBe(1);
    expect(nextRound(state, 24)).toBe(4);
  });

  it('offers an untouched aborted round again', () => {
    const state = apply(startedState(RULES, 5), [{ type: 'ROUND_ABORTED', round: 5, reason: 'x' }]);
    expect(nextRound(state, 24)).toBe(5);
  });

  it('returns undefined when everything is played', () => {
    const state = completeRound(startedState());
    expect(nextRound(state, 1)).toBeUndefined();
  });
});

describe('round ring and summaries', () => {
  it('marks done, current, aborted and upcoming rounds', () => {
    let state = completeRound(startedState());
    state = run(state, startNextRound(state, CONTEXT));
    state = drawAll(state, [4]);
    state = apply(state, [{ type: 'ROUND_ABORTED', round: 2, reason: 'x' }]);
    state = run(state, startNextRound(state, CONTEXT));
    expect(roundRing(state, 4)).toEqual(['DONE', 'ABORTED', 'CURRENT', 'UPCOMING']);
    expect(unplayedRounds(state, 4)).toEqual([2, 4]);
    expect(completedRoundCount(state)).toBe(1);
  });
});
