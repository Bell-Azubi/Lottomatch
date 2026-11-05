import { describe, expect, it } from 'vitest';
import { seededSource, sequenceSource } from '../test/domain-builders';
import { pickUniform, uniformIndex, uniformNumber } from './random';

const TOP = 2 ** 32 - 1;

describe('uniformIndex', () => {
  it('maps accepted values with modulo', () => {
    expect(uniformIndex(3, sequenceSource([0]))).toBe(0);
    expect(uniformIndex(3, sequenceSource([5]))).toBe(2);
    expect(uniformIndex(90, sequenceSource([91]))).toBe(1);
  });

  it('rejects values at or above the largest multiple of the size', () => {
    // 2^32 mod 3 = 1, so only 2^32 - 1 is rejected.
    const calls: number[] = [];
    const source = sequenceSource([TOP, 7]);
    const result = uniformIndex(3, () => {
      const value = source();
      calls.push(value);
      return value;
    });
    expect(result).toBe(1);
    expect(calls).toEqual([TOP, 7]);
  });

  it('accepts the last value below the limit', () => {
    const limit = 2 ** 32 - (2 ** 32 % 90);
    expect(uniformIndex(90, sequenceSource([limit - 1]))).toBe((limit - 1) % 90);
    expect(uniformIndex(90, sequenceSource([limit, 3]))).toBe(3);
  });

  it('always returns 0 for size 1', () => {
    expect(uniformIndex(1, sequenceSource([TOP]))).toBe(0);
  });

  it('throws on invalid sizes and broken sources', () => {
    expect(() => uniformIndex(0, sequenceSource([1]))).toThrow(RangeError);
    expect(() => uniformIndex(2.5, sequenceSource([1]))).toThrow(RangeError);
    expect(() => uniformIndex(3, () => -1)).toThrow(RangeError);
    expect(() => uniformIndex(3, () => 2 ** 32)).toThrow(RangeError);
    expect(() => uniformIndex(3, () => TOP)).toThrow('rejected too often');
  });

  it('is uniform over a large deterministic sample (chi-square, fixed threshold)', () => {
    const buckets = 90;
    const samples = 180_000;
    const counts = new Array<number>(buckets).fill(0);
    const next = seededSource(20_260_105);
    for (let i = 0; i < samples; i += 1) {
      const index = uniformIndex(buckets, next);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    const expected = samples / buckets;
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    // df = 89: mean 89, sd ≈ 13.3. 200 is beyond p < 1e-12, so a pass is not luck-dependent.
    expect(chiSquare).toBeLessThan(200);
  });
});

describe('pickUniform and uniformNumber', () => {
  it('returns undefined for an empty list', () => {
    expect(pickUniform<number>([], sequenceSource([1]))).toBeUndefined();
  });

  it('picks by index', () => {
    expect(pickUniform(['a', 'b', 'c'], sequenceSource([4]))).toBe('b');
  });

  it('draws numbers from 1 to max', () => {
    expect(uniformNumber(90, sequenceSource([0]))).toBe(1);
    expect(uniformNumber(90, sequenceSource([89]))).toBe(90);
  });
});
