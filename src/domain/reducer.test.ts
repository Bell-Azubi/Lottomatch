import { describe, expect, it } from 'vitest';
import { logOf, PRIZE_RULES, RULES } from '../test/domain-builders';
import { replay } from './reducer';
import { activePool, roundOf } from './state';
import type { LogEvent } from './types';

const flow: LogEvent[] = [
  { type: 'ROUND_STARTED', round: 1, rules: RULES },
  { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 1, number: 42, method: 'RANDOM' } },
  { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 2, number: 7, method: 'MANUAL' } },
  { type: 'DRAW_UNDONE', round: 1, seq: 2 },
  { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 2, number: 8, method: 'MANUAL' } },
  { type: 'CLAIM_REJECTED', round: 1, slot: 1, claimed: [42, 1], missing: [1] },
  {
    type: 'PRIZE_AWARDED',
    round: 1,
    slot: 1,
    winners: [{ cardNo: '5' }],
    prize: { winCondition: { kind: 'ONE_LINE' } },
  },
  { type: 'SETTINGS_CHANGED', changes: [{ field: 'name', from: 'a', to: 'b' }] },
];

describe('replay', () => {
  it('rebuilds the state from a log', () => {
    const result = replay(logOf(flow));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.value;
    expect(state.lastLogSeq).toBe(flow.length);
    expect(activePool(state)?.draws.map((d) => d.number)).toEqual([42, 8]);
    expect(roundOf(state, 1).rejectedClaims).toBe(1);
    expect(roundOf(state, 1).prizes[1].award?.drawCount).toBe(2);
    expect(roundOf(state, 1).startedAt).toBe('2026-11-07T18:00:00.000Z');
  });

  it('detects gaps in the sequence (I7)', () => {
    const log = logOf(flow);
    const gapped = [log[0], log[2]].filter((e) => e !== undefined);
    expect(replay(gapped)).toEqual({
      ok: false,
      error: { seq: 3, cause: { code: 'SEQUENCE_GAP' } },
    });
  });

  it('detects events that break an invariant', () => {
    const corrupt = logOf(flow.slice(0, 2)).concat(
      logOf([
        ...flow.slice(0, 2),
        { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 2, number: 42, method: 'MANUAL' } },
      ]).slice(2),
    );
    const result = replay(corrupt);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toEqual({ seq: 3, cause: { code: 'NUMBER_ALREADY_DRAWN', number: 42 } });
  });

  it('keeps draws of other prizes out of the pool in prize mode', () => {
    const result = replay(
      logOf([
        { type: 'ROUND_STARTED', round: 1, rules: PRIZE_RULES },
        { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 1, number: 3, method: 'RANDOM' } },
        { type: 'PRIZE_SKIPPED', round: 1, slot: 1, reason: 'leer' },
        { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 2, number: 3, method: 'RANDOM' } },
      ]),
    );
    expect(result.ok && activePool(result.value)?.draws.map((d) => d.slot)).toEqual([2]);
  });
});
