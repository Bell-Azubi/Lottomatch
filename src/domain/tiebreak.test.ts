import { describe, expect, it } from 'vitest';
import { applyTiebreakPass, drawsOfPass, startTiebreak } from './tiebreak';

function scripted(numbers: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = numbers[index] ?? 1;
    index += 1;
    return value;
  };
}

describe('Stechen (FR-7)', () => {
  it('decides in one pass with the highest number', () => {
    const state = applyTiebreakPass(startTiebreak(3, 'HIGHEST'), scripted([12, 80, 33]));
    expect(state.winner).toBe(1);
    expect(state.pass).toBe(1);
    expect(drawsOfPass(state, 1).map((d) => d.number)).toEqual([12, 80, 33]);
  });

  it('decides with the lowest number when configured', () => {
    const state = applyTiebreakPass(startTiebreak(2, 'LOWEST'), scripted([12, 80]));
    expect(state.winner).toBe(0);
  });

  it('re-draws only among tied claimants', () => {
    let state = startTiebreak(3, 'HIGHEST');
    state = applyTiebreakPass(state, scripted([70, 70, 10]));
    expect(state.winner).toBeUndefined();
    expect(state.contenders).toEqual([0, 1]);
    state = applyTiebreakPass(state, scripted([50, 50]));
    expect(state.contenders).toEqual([0, 1]);
    state = applyTiebreakPass(state, scripted([5, 60]));
    expect(state.winner).toBe(1);
    expect(state.pass).toBe(3);
    expect(drawsOfPass(state, 3).map((d) => d.claimant)).toEqual([0, 1]);
    expect(state.draws).toHaveLength(7);
  });

  it('rejects invalid use', () => {
    expect(() => startTiebreak(1, 'HIGHEST')).toThrow(RangeError);
    const decided = applyTiebreakPass(startTiebreak(2, 'HIGHEST'), scripted([1, 2]));
    expect(() => applyTiebreakPass(decided, scripted([1]))).toThrow('already decided');
  });
});
