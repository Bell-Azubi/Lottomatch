import type { TiebreakOrder } from './settings';
import type { TiebreakDraw } from './types';

/** Progress of a Stechen among claimants (FR-7). */
export interface TiebreakState {
  readonly order: TiebreakOrder;
  readonly claimantCount: number;
  /** Every draw so far, across passes. */
  readonly draws: readonly TiebreakDraw[];
  /** Claimants still in contention, ascending. */
  readonly contenders: readonly number[];
  readonly pass: number;
  /** Index of the winning claimant once decided. */
  readonly winner?: number;
}

/** Starts a Stechen; needs at least two claimants. */
export function startTiebreak(claimantCount: number, order: TiebreakOrder): TiebreakState {
  if (!Number.isInteger(claimantCount) || claimantCount < 2) {
    throw new RangeError(`startTiebreak: need at least two claimants, got ${claimantCount}`);
  }
  return {
    order,
    claimantCount,
    draws: [],
    contenders: Array.from({ length: claimantCount }, (_, index) => index),
    pass: 0,
  };
}

/**
 * Records one pass: `drawFor` yields the number drawn for each contender. The best number
 * (highest or lowest) wins; remaining ties stay in contention for the next pass.
 */
export function applyTiebreakPass(
  state: TiebreakState,
  drawFor: (claimant: number) => number,
): TiebreakState {
  if (state.winner !== undefined) throw new Error('applyTiebreakPass: tie-break already decided');
  const pass = state.pass + 1;
  const draws = state.contenders.map((claimant) => ({ claimant, number: drawFor(claimant), pass }));
  const numbers = draws.map((d) => d.number);
  const best = state.order === 'HIGHEST' ? Math.max(...numbers) : Math.min(...numbers);
  const contenders = draws.filter((d) => d.number === best).map((d) => d.claimant);
  const [first] = contenders;
  return {
    ...state,
    draws: [...state.draws, ...draws],
    contenders,
    pass,
    ...(contenders.length === 1 && first !== undefined ? { winner: first } : {}),
  };
}

/** Draws of one pass, in contender order. */
export function drawsOfPass(state: TiebreakState, pass: number): readonly TiebreakDraw[] {
  return state.draws.filter((d) => d.pass === pass);
}
