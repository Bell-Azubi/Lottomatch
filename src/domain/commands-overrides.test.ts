import { describe, expect, it } from 'vitest';
import { apply, CONTEXT, drawAll, PRIZE_RULES, run, startedState } from '../test/domain-builders';
import {
  abortRound,
  awardPrize,
  completeEvent,
  correctWinners,
  drawManual,
  jumpToRound,
  revokeLatestAward,
  setHandout,
  skipPrize,
  startNextRound,
} from './commands';
import { activePool, activeSlot, initialGameState, roundOf, type GameState } from './state';
import type { PrizeSnapshot } from './types';

const PRIZE: PrizeSnapshot = { title: 'Präsentkorb', winCondition: { kind: 'ONE_LINE' } };
const award = (state: GameState, cardNo = '17'): GameState =>
  run(state, awardPrize(state, { winners: [{ cardNo }], prize: PRIZE }));

function errorCode(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

describe('revocation (FR-4, I4)', () => {
  it('revokes the latest award and reactivates its prize', () => {
    let state = award(award(drawAll(startedState(), [1])));
    state = run(state, revokeLatestAward(state, 'Karte falsch gelesen'));
    expect(activeSlot(state)).toBe(2);
    expect(roundOf(state, 1).prizes[2].status).toBe('OPEN');
    expect(roundOf(state, 1).revokedAwards).toBe(1);
  });

  it('reopens a completed round when its last prize is revoked', () => {
    let state = startedState();
    for (let i = 0; i < 4; i += 1) state = award(drawAll(state, [i + 1]));
    state = run(state, revokeLatestAward(state, 'Fehler'));
    expect(state.phase).toBe('ROUND_RUNNING');
    expect(activeSlot(state)).toBe(4);
    expect(roundOf(state, 1).endedAt).toBeUndefined();
  });

  it('cannot revoke a skip, an earlier round or without a reason', () => {
    const skipped = run(startedState(), skipPrize(startedState(), 'x'));
    expect(errorCode(revokeLatestAward(skipped, 'Fehler'))).toBe('NO_AWARD_TO_REVOKE');
    expect(errorCode(revokeLatestAward(startedState(), 'Fehler'))).toBe('NO_AWARD_TO_REVOKE');
    expect(errorCode(revokeLatestAward(initialGameState(), 'Fehler'))).toBe('NO_AWARD_TO_REVOKE');
    const awarded = award(startedState());
    expect(errorCode(revokeLatestAward(awarded, ''))).toBe('REASON_REQUIRED');
    let later = startedState();
    for (let i = 0; i < 4; i += 1) later = award(drawAll(later, [i + 1]));
    later = run(later, startNextRound(later, CONTEXT));
    expect(errorCode(revokeLatestAward(later, 'Fehler'))).toBe('NO_AWARD_TO_REVOKE');
  });

  it('requires no later draws in prize mode', () => {
    const awarded = award(drawAll(startedState(PRIZE_RULES), [5]));
    expect(revokeLatestAward(awarded, 'Fehler').ok).toBe(true);
    const drawnAfter = drawAll(awarded, [9]);
    expect(errorCode(revokeLatestAward(drawnAfter, 'Fehler'))).toBe('REVOKE_BLOCKED_BY_DRAWS');
  });

  it('allows later draws in round mode', () => {
    const state = drawAll(award(drawAll(startedState(), [5])), [9]);
    expect(revokeLatestAward(state, 'Fehler').ok).toBe(true);
  });

  it('cannot revoke in an aborted round', () => {
    let state = award(drawAll(startedState(), [5]));
    state = run(state, abortRound(state, 'Abbruch'));
    expect(errorCode(revokeLatestAward(state, 'Fehler'))).toBe('NO_AWARD_TO_REVOKE');
  });
});

describe('overrides and completion', () => {
  it('requires reasons for skip and abort', () => {
    expect(errorCode(skipPrize(startedState(), ' '))).toBe('REASON_REQUIRED');
    expect(errorCode(abortRound(startedState(), ''))).toBe('REASON_REQUIRED');
  });

  it('returns an untouched aborted round to upcoming', () => {
    const state = run(startedState(), abortRound(startedState(), 'zu früh gestartet'));
    expect(roundOf(state, 1).status).toBe('UPCOMING');
    expect(roundOf(state, 1).runs).toBe(0);
    expect(run(state, startNextRound(state, CONTEXT)).currentRound).toBe(1);
  });

  it('keeps awards of an aborted round and resumes it by jump', () => {
    let state = award(drawAll(startedState(), [1, 2]));
    state = run(state, abortRound(state, 'Pause'));
    expect(roundOf(state, 1).status).toBe('ABORTED');
    state = run(state, startNextRound(state, CONTEXT));
    expect(state.currentRound).toBe(2);
    state = run(state, jumpToRound(state, CONTEXT, 1, 'Runde 1 fertig spielen'));
    expect(state.currentRound).toBe(1);
    expect(activeSlot(state)).toBe(2);
    expect(roundOf(state, 1).runs).toBe(2);
    expect(activePool(state)?.draws).toEqual([]);
  });

  it('completes the event and locks play', () => {
    let state = startedState();
    for (let i = 0; i < 4; i += 1) state = award(drawAll(state, [i + 1]));
    expect(errorCode(completeEvent(startedState()))).toBe('ROUND_RUNNING');
    state = run(state, completeEvent(state));
    expect(state.phase).toBe('COMPLETED');
    expect(errorCode(startNextRound(state, CONTEXT))).toBe('EVENT_COMPLETED');
    expect(errorCode(drawManual(state, 5))).toBe('EVENT_COMPLETED');
    expect(errorCode(revokeLatestAward(state, 'x'))).toBe('EVENT_COMPLETED');
    expect(errorCode(jumpToRound(state, CONTEXT, 3, 'x'))).toBe('EVENT_COMPLETED');
    expect(errorCode(completeEvent(state))).toBe('EVENT_COMPLETED');
  });

  it('corrects winner details and handout status, even after completion', () => {
    let state = startedState();
    for (let i = 0; i < 4; i += 1) state = award(drawAll(state, [i + 1]));
    state = run(state, completeEvent(state));
    state = run(
      state,
      correctWinners(state, 1, 2, [{ cardNo: '18', name: 'Muster' }], 'Tippfehler'),
    );
    expect(roundOf(state, 1).prizes[2].award?.winners).toEqual([{ cardNo: '18', name: 'Muster' }]);
    expect(roundOf(state, 1).prizes[2].award?.corrections).toBe(1);
    state = run(state, setHandout(state, 1, 2, 'COLLECTED'));
    expect(roundOf(state, 1).prizes[2].award?.handout).toBe('COLLECTED');
    expect(errorCode(correctWinners(state, 2, 1, [{}], ''))).toBe('PRIZE_NOT_AWARDED');
    expect(errorCode(correctWinners(state, 1, 2, [{}, {}], ''))).toBe('WINNER_COUNT_MISMATCH');
    expect(errorCode(setHandout(state, 3, 1, 'COLLECTED'))).toBe('PRIZE_NOT_AWARDED');
  });

  it('applies audit-only events without changing the game', () => {
    const state = startedState();
    const next = apply(state, [{ type: 'PIN_RESET' }]);
    expect(next.lastLogSeq).toBe(state.lastLogSeq + 1);
    expect(next.rounds).toBe(state.rounds);
  });
});
