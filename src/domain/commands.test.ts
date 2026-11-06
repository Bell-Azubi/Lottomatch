import { describe, expect, it } from 'vitest';
import {
  CONTEXT,
  drawAll,
  PRIZE_RULES,
  run,
  sequenceSource,
  startedState,
} from '../test/domain-builders';
import {
  awardPrize,
  drawManual,
  drawRandom,
  jumpToRound,
  rejectClaim,
  skipPrize,
  startNextRound,
  undoLastDraw,
} from './commands';
import { activePool, activeSlot, initialGameState, roundOf, type GameState } from './state';
import type { PrizeSnapshot } from './types';

const PRIZE: PrizeSnapshot = { title: 'Präsentkorb', winCondition: { kind: 'ONE_LINE' } };
const award = (state: GameState, cardNo = '17'): GameState =>
  run(state, awardPrize(state, { winners: [{ cardNo }], prize: PRIZE }));

function errorCode(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

describe('starting rounds', () => {
  it('starts round 1 first and the next round after completion', () => {
    let state = run(initialGameState(), startNextRound(initialGameState(), CONTEXT));
    expect(state.phase).toBe('ROUND_RUNNING');
    expect(state.currentRound).toBe(1);
    expect(activeSlot(state)).toBe(1);
    for (let slot = 0; slot < 4; slot += 1) state = award(drawAll(state, [slot + 1]));
    expect(state.phase).toBe('BETWEEN_ROUNDS');
    expect(roundOf(state, 1).status).toBe('COMPLETED');
    state = run(state, startNextRound(state, CONTEXT));
    expect(state.currentRound).toBe(2);
    expect(activePool(state)?.draws).toEqual([]);
  });

  it('refuses to start while a round runs (I5)', () => {
    const state = startedState();
    expect(errorCode(startNextRound(state, CONTEXT))).toBe('ROUND_RUNNING');
  });

  it('reports when no round is left', () => {
    let state = run(
      initialGameState(),
      startNextRound(initialGameState(), { ...CONTEXT, totalRounds: 1 }),
    );
    state = run(state, skipPrize(state, 'Kein Preis'));
    state = run(state, skipPrize(state, 'Kein Preis'));
    state = run(state, skipPrize(state, 'Kein Preis'));
    state = run(state, skipPrize(state, 'Kein Preis'));
    expect(errorCode(startNextRound(state, { ...CONTEXT, totalRounds: 1 }))).toBe('NO_ROUND_LEFT');
  });

  it('jumps to a round, aborting the running one with the same reason', () => {
    let state = drawAll(startedState(), [5, 6]);
    state = run(state, jumpToRound(state, CONTEXT, 10, 'Zeitplan'));
    expect(state.currentRound).toBe(10);
    expect(roundOf(state, 1).status).toBe('ABORTED');
    expect(roundOf(state, 1).abortReason).toBe('Zeitplan');
    expect(roundOf(state, 2).status).toBe('UPCOMING');
  });

  it('validates jump targets and reasons', () => {
    const state = startedState();
    expect(errorCode(jumpToRound(state, CONTEXT, 2, '  '))).toBe('REASON_REQUIRED');
    expect(errorCode(jumpToRound(state, CONTEXT, 25, 'x'))).toBe('ROUND_OUT_OF_RANGE');
    expect(errorCode(jumpToRound(state, CONTEXT, 1, 'x'))).toBe('ROUND_RUNNING');
  });

  it('refuses to jump to a completed round', () => {
    let state = startedState();
    for (let slot = 0; slot < 4; slot += 1) state = run(state, skipPrize(state, 'x'));
    expect(errorCode(jumpToRound(state, CONTEXT, 1, 'nochmals'))).toBe('ROUND_ALREADY_COMPLETED');
  });
});

describe('draws', () => {
  it('draws uniformly from the remaining numbers', () => {
    const state = drawAll(startedState(), [1, 2]);
    const result = drawRandom(state, sequenceSource([0]));
    expect(result.ok && result.value[0]).toEqual({
      type: 'NUMBER_DRAWN',
      round: 1,
      draw: { seq: 3, number: 3, method: 'RANDOM' },
    });
  });

  it('draws the last number of the pool and then reports an empty pool', () => {
    const numbers = Array.from({ length: 89 }, (_, i) => i + 1);
    let state = drawAll(startedState(), numbers);
    state = run(state, drawRandom(state, sequenceSource([123])));
    expect(activePool(state)?.draws.at(-1)?.number).toBe(90);
    expect(errorCode(drawRandom(state, sequenceSource([0])))).toBe('POOL_EMPTY');
  });

  it('rejects duplicates and out-of-range manual numbers (I1)', () => {
    const state = drawAll(startedState(), [42]);
    expect(drawManual(state, 42)).toEqual({
      ok: false,
      error: { code: 'NUMBER_ALREADY_DRAWN', number: 42 },
    });
    expect(errorCode(drawManual(state, 0))).toBe('NUMBER_OUT_OF_RANGE');
    expect(errorCode(drawManual(state, 91))).toBe('NUMBER_OUT_OF_RANGE');
    expect(errorCode(drawManual(state, 4.2))).toBe('NUMBER_OUT_OF_RANGE');
  });

  it('requires a running round', () => {
    expect(errorCode(drawManual(initialGameState(), 1))).toBe('NO_ROUND_RUNNING');
    expect(errorCode(drawRandom(initialGameState(), sequenceSource([1])))).toBe('NO_ROUND_RUNNING');
  });

  it('records the method of each draw', () => {
    let state = run(startedState(), drawRandom(startedState(), sequenceSource([9])));
    state = run(state, drawManual(state, 50));
    expect(activePool(state)?.draws.map((d) => d.method)).toEqual(['RANDOM', 'MANUAL']);
  });
});

describe('undo (FR-4, I3)', () => {
  it('reverts only the latest draw', () => {
    let state = drawAll(startedState(), [10, 20, 30]);
    state = run(state, undoLastDraw(state));
    expect(activePool(state)?.draws.map((d) => d.number)).toEqual([10, 20]);
  });

  it('has nothing to undo at the start of a round', () => {
    expect(errorCode(undoLastDraw(startedState()))).toBe('NOTHING_TO_UNDO');
  });

  it('is blocked by a later award or skip', () => {
    const awarded = award(drawAll(startedState(), [1, 2, 3, 4, 5]));
    expect(errorCode(undoLastDraw(awarded))).toBe('UNDO_BLOCKED');
    const skipped = run(drawAll(startedState(), [1]), skipPrize(drawAll(startedState(), [1]), 'x'));
    expect(errorCode(undoLastDraw(skipped))).toBe('UNDO_BLOCKED');
  });

  it('is allowed again for draws after the award', () => {
    let state = drawAll(award(drawAll(startedState(), [1])), [2]);
    state = run(state, undoLastDraw(state));
    expect(activePool(state)?.draws.map((d) => d.number)).toEqual([1]);
  });

  it('reuses the freed draw position', () => {
    let state = drawAll(startedState(), [1, 2]);
    state = run(state, undoLastDraw(state));
    state = run(state, drawManual(state, 77));
    expect(activePool(state)?.draws.at(-1)).toMatchObject({ seq: 2, number: 77 });
  });
});

describe('awards and claims', () => {
  it('awards the active prize and activates the next one', () => {
    const state = award(drawAll(startedState(), [1, 2, 3, 4, 5]));
    const outcome = roundOf(state, 1).prizes[1];
    expect(outcome.status).toBe('AWARDED');
    expect(outcome.award?.drawCount).toBe(5);
    expect(activeSlot(state)).toBe(2);
  });

  it('keeps drawn numbers across prizes in round mode', () => {
    const state = drawAll(award(drawAll(startedState(), [1, 2])), [3]);
    expect(activePool(state)?.draws.map((d) => d.number)).toEqual([1, 2, 3]);
  });

  it('gives each prize its own pool in prize mode', () => {
    const state = drawAll(award(drawAll(startedState(PRIZE_RULES), [1, 2])), [1]);
    expect(activePool(state)?.draws.map((d) => d.number)).toEqual([1]);
    expect(roundOf(state, 1).draws).toHaveLength(3);
    expect(activePool(state)?.draws[0]?.seq).toBe(3);
  });

  it('records a false claim and continues', () => {
    const state = drawAll(startedState(), [1, 2]);
    const next = run(state, rejectClaim(state, [1, 2, 3, 4, 5], [3, 4, 5]));
    expect(roundOf(next, 1).rejectedClaims).toBe(1);
    expect(activeSlot(next)).toBe(1);
  });

  it('records a rejected late claim', () => {
    const state = drawAll(startedState(), [1, 2]);
    expect(rejectClaim(state, [1, 2], [], 1).ok).toBe(true);
    expect(errorCode(rejectClaim(state, [1, 2], []))).toBe('INVALID_CLAIM');
  });

  it('awards shared prizes and Stechen results', () => {
    const state = drawAll(startedState(), [1]);
    const shared = awardPrize(state, { winners: [{ cardNo: '1' }, { cardNo: '2' }], prize: PRIZE });
    expect(shared.ok).toBe(true);
    const claimants = [{ cardNo: '1' }, { cardNo: '2' }];
    const tiebreak = [
      { claimant: 0, number: 40, pass: 1 },
      { claimant: 1, number: 12, pass: 1 },
    ];
    const stechen = awardPrize(state, {
      winners: [{ cardNo: '1' }],
      prize: PRIZE,
      claimants,
      tiebreak,
    });
    expect(stechen.ok).toBe(true);
    expect(errorCode(awardPrize(state, { winners: [], prize: PRIZE }))).toBe('INVALID_WINNERS');
  });

  it('completes the round after the fourth prize', () => {
    let state = startedState();
    for (let i = 0; i < 4; i += 1) state = award(drawAll(state, [i + 10]));
    expect(roundOf(state, 1).status).toBe('COMPLETED');
    expect(state.phase).toBe('BETWEEN_ROUNDS');
    expect(errorCode(awardPrize(state, { winners: [{}], prize: PRIZE }))).toBe('NO_ROUND_RUNNING');
  });
});
