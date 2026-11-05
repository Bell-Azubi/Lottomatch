import { describe, expect, it } from 'vitest';
import { drawAll, startedState } from '../test/domain-builders';
import { checkClaimNumber, claimVerdict, evaluateClaim } from './claim';
import { activePool } from './state';

const pool = activePool(drawAll(startedState(), [5, 12, 23, 34, 42, 61, 77]))?.draws ?? [];

describe('evaluateClaim (FR-6)', () => {
  it('marks drawn and missing numbers', () => {
    const result = evaluateClaim(pool, [5, 12, 23, 34, 50], 5);
    expect(result.drawn.map((d) => d.number)).toEqual([5, 12, 23, 34]);
    expect(result.missing).toEqual([50]);
    expect(result.complete).toBe(false);
    expect(result.validSince).toBeUndefined();
    expect(result.late).toBe(false);
  });

  it('finds the draw that completed the claim and flags a late claim', () => {
    const result = evaluateClaim(pool, [5, 12, 23, 34, 42], 5);
    expect(result.complete).toBe(true);
    expect(result.validSince).toEqual({ number: 42, seq: 5 });
    expect(result.latest).toEqual({ number: 77, seq: 7 });
    expect(result.late).toBe(true);
  });

  it('is not late when the latest draw completed the claim', () => {
    const result = evaluateClaim(pool, [77, 5, 12, 23, 34], 5);
    expect(result.validSince).toEqual({ number: 77, seq: 7 });
    expect(result.late).toBe(false);
  });

  it('requires the expected count', () => {
    const result = evaluateClaim(pool, [5, 12, 23, 34], 5);
    expect(result.countMatches).toBe(false);
    expect(result.complete).toBe(false);
  });

  it('accepts any non-empty count for custom rules', () => {
    expect(evaluateClaim(pool, [5], undefined).complete).toBe(true);
    expect(evaluateClaim(pool, [], undefined).complete).toBe(false);
  });

  it('handles an empty pool', () => {
    const result = evaluateClaim([], [1], undefined);
    expect(result.latest).toBeUndefined();
    expect(result.missing).toEqual([1]);
  });
});

describe('claimVerdict', () => {
  const late = evaluateClaim(pool, [5, 12, 23, 34, 42], 5);
  const valid = evaluateClaim(pool, [5, 12, 23, 34, 77], 5);
  const invalid = evaluateClaim(pool, [1, 2, 3, 4, 5], 5);

  it('applies the late-claim policy', () => {
    expect(claimVerdict(late, 'ALLOW')).toBe('VALID');
    expect(claimVerdict(late, 'REJECT')).toBe('LATE_REJECTED');
    expect(claimVerdict(late, 'HOST_DECIDES')).toBe('LATE_DECIDE');
  });

  it('passes timely claims and fails incomplete ones', () => {
    expect(claimVerdict(valid, 'REJECT')).toBe('VALID');
    expect(claimVerdict(invalid, 'ALLOW')).toBe('INVALID');
  });
});

describe('checkClaimNumber', () => {
  it('rejects non-integers, out-of-range numbers and duplicates', () => {
    expect(checkClaimNumber(4.5, [], 90)).toBe('NOT_A_NUMBER');
    expect(checkClaimNumber(0, [], 90)).toBe('OUT_OF_RANGE');
    expect(checkClaimNumber(91, [], 90)).toBe('OUT_OF_RANGE');
    expect(checkClaimNumber(7, [7], 90)).toBe('DUPLICATE');
    expect(checkClaimNumber(7, [8], 90)).toBeUndefined();
  });
});
