import { describe, expect, it } from 'vitest';
import { apply, drawAll, RULES, startedState } from '../test/domain-builders';
import { checkEvent, validTiebreak, validWinner } from './check';
import { initialGameState, type GameState } from './state';
import type { LogEvent } from './types';

const code = (state: GameState, event: LogEvent) => {
  const result = checkEvent(state, event);
  return result.ok ? 'OK' : result.error.code;
};

const PRIZE = { winCondition: { kind: 'ONE_LINE' } } as const;

describe('checkEvent: round start', () => {
  const start = (round: number, extra: object = {}): LogEvent => ({
    type: 'ROUND_STARTED',
    round,
    rules: RULES,
    ...extra,
  });

  it('validates round numbers, rules and reasons', () => {
    const ready = initialGameState();
    expect(code(ready, start(0))).toBe('ROUND_OUT_OF_RANGE');
    expect(code(ready, start(51))).toBe('ROUND_OUT_OF_RANGE');
    expect(
      code(ready, { type: 'ROUND_STARTED', round: 1, rules: { ...RULES, maxNumber: 29 } }),
    ).toBe('INVALID_RULES');
    expect(
      code(ready, {
        type: 'ROUND_STARTED',
        round: 1,
        rules: { ...RULES, perLine: 9, lines: 6, maxNumber: 50 },
      }),
    ).toBe('INVALID_RULES');
    expect(code(ready, start(1, { reason: ' ' }))).toBe('REASON_REQUIRED');
    expect(code(ready, start(1, { reason: 'r'.repeat(201) }))).toBe('REASON_REQUIRED');
    expect(code(ready, start(1, { reason: 'Sprung' }))).toBe('OK');
    expect(code(startedState(), start(2))).toBe('ROUND_RUNNING');
  });

  it('rejects starts after completion', () => {
    const completed = apply(initialGameState(), [{ type: 'EVENT_COMPLETED' }]);
    expect(code(completed, start(1))).toBe('EVENT_COMPLETED');
  });
});

describe('checkEvent: draws and undo', () => {
  const state = drawAll(startedState(), [10]);

  it('rejects mismatched rounds and sequence numbers', () => {
    expect(
      code(state, {
        type: 'NUMBER_DRAWN',
        round: 2,
        draw: { seq: 2, number: 1, method: 'RANDOM' },
      }),
    ).toBe('ROUND_MISMATCH');
    expect(
      code(state, {
        type: 'NUMBER_DRAWN',
        round: 1,
        draw: { seq: 5, number: 1, method: 'RANDOM' },
      }),
    ).toBe('SEQUENCE_MISMATCH');
    expect(code(state, { type: 'DRAW_UNDONE', round: 1, seq: 7 })).toBe('SEQUENCE_MISMATCH');
    expect(code(initialGameState(), { type: 'DRAW_UNDONE', round: 1, seq: 1 })).toBe(
      'NO_ROUND_RUNNING',
    );
  });
});

describe('checkEvent: claims and awards', () => {
  const state = drawAll(startedState(), [1, 2, 3]);

  it('validates rejected claims', () => {
    const reject = (extra: object): LogEvent => ({
      type: 'CLAIM_REJECTED',
      round: 1,
      slot: 1,
      claimed: [1, 4],
      missing: [4],
      ...extra,
    });
    expect(code(state, reject({}))).toBe('OK');
    expect(code(state, reject({ slot: 2 }))).toBe('SLOT_MISMATCH');
    expect(code(state, reject({ claimed: [4, 4], missing: [4] }))).toBe('INVALID_CLAIM');
    expect(code(state, reject({ missing: [9] }))).toBe('INVALID_CLAIM');
    expect(code(state, reject({ claimed: [0], missing: [0] }))).toBe('INVALID_CLAIM');
    expect(code(state, reject({ missing: [], lateSinceSeq: 0 }))).toBe('INVALID_CLAIM');
  });

  it('validates winners and Stechen records', () => {
    const awardWith = (extra: object): LogEvent => ({
      type: 'PRIZE_AWARDED',
      round: 1,
      slot: 1,
      winners: [{ cardNo: '1' }],
      prize: PRIZE,
      ...extra,
    });
    expect(code(state, awardWith({ winners: [{ cardNo: 'x'.repeat(21) }] }))).toBe(
      'INVALID_WINNERS',
    );
    expect(code(state, awardWith({ prize: { winCondition: { kind: 'CUSTOM', label: '' } } }))).toBe(
      'INVALID_WINNERS',
    );
    expect(code(state, awardWith({ winners: Array.from({ length: 21 }, () => ({})) }))).toBe(
      'INVALID_WINNERS',
    );
    expect(code(state, awardWith({ claimants: [{}, {}] }))).toBe('INVALID_TIEBREAK');
    const tiebreak = [
      { claimant: 0, number: 5, pass: 1 },
      { claimant: 1, number: 9, pass: 1 },
    ];
    expect(code(state, awardWith({ claimants: [{}, {}], tiebreak }))).toBe('OK');
    expect(code(state, awardWith({ claimants: [{}, {}], tiebreak, winners: [{}, {}] }))).toBe(
      'INVALID_TIEBREAK',
    );
    expect(code(state, awardWith({ tiebreak }))).toBe('INVALID_TIEBREAK');
    expect(code(state, awardWith({ slot: 3 }))).toBe('SLOT_MISMATCH');
  });

  it('validates skips, revocations and corrections', () => {
    expect(code(state, { type: 'PRIZE_SKIPPED', round: 1, slot: 2, reason: 'x' })).toBe(
      'SLOT_MISMATCH',
    );
    expect(code(state, { type: 'PRIZE_SKIPPED', round: 1, slot: 1, reason: '' })).toBe(
      'REASON_REQUIRED',
    );
    expect(code(state, { type: 'ROUND_ABORTED', round: 2, reason: 'x' })).toBe('ROUND_MISMATCH');
    const awarded = apply(state, [
      { type: 'PRIZE_AWARDED', round: 1, slot: 1, winners: [{}], prize: PRIZE },
    ]);
    expect(code(awarded, { type: 'AWARD_REVOKED', round: 1, slot: 2, reason: 'x' })).toBe(
      'NO_AWARD_TO_REVOKE',
    );
    expect(code(awarded, { type: 'AWARD_REVOKED', round: 2, slot: 1, reason: 'x' })).toBe(
      'NO_AWARD_TO_REVOKE',
    );
    expect(
      code(awarded, {
        type: 'WINNER_CORRECTED',
        round: 1,
        slot: 1,
        winners: [{}],
        reason: 'r'.repeat(201),
      }),
    ).toBe('REASON_REQUIRED');
    expect(
      code(awarded, {
        type: 'WINNER_CORRECTED',
        round: 1,
        slot: 1,
        winners: [{ name: 'n'.repeat(81) }],
        reason: '',
      }),
    ).toBe('INVALID_WINNERS');
  });
});

describe('structural helpers', () => {
  it('validates winners', () => {
    expect(validWinner({ validSinceSeq: 0 })).toBe(false);
    expect(validWinner({ note: 'n'.repeat(201) })).toBe(false);
    expect(validWinner({ cardNo: '12', name: 'Muster', note: 'Tisch 4', validSinceSeq: 37 })).toBe(
      true,
    );
  });

  it('validates Stechen draws', () => {
    expect(validTiebreak([{ claimant: 0, number: 1, pass: 1 }], 1, 90)).toBe(false);
    expect(validTiebreak([{ claimant: 0, number: 1, pass: 1 }], 2, 90)).toBe(false);
    const draws = [
      { claimant: 0, number: 1, pass: 1 },
      { claimant: 2, number: 1, pass: 1 },
    ];
    expect(validTiebreak(draws, 2, 90)).toBe(false);
    expect(
      validTiebreak(
        [
          { claimant: 0, number: 91, pass: 1 },
          { claimant: 1, number: 1, pass: 1 },
        ],
        2,
        90,
      ),
    ).toBe(false);
    expect(
      validTiebreak(
        [
          { claimant: 0, number: 9, pass: 0 },
          { claimant: 1, number: 1, pass: 1 },
        ],
        2,
        90,
      ),
    ).toBe(false);
  });
});
