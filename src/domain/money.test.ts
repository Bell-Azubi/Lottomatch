import { describe, expect, it } from 'vitest';
import { chfToPlain, parseChf } from './money';

describe('parseChf (FR-8)', () => {
  it.each([
    ['50', 50],
    ['50.–', 50],
    ['50.-', 50],
    ['50.50', 50.5],
    ['50,50', 50.5],
    ["1'000.50", 1000.5],
    ['1’000.50', 1000.5],
    ['1 000', 1000],
    ['CHF 25', 25],
    ['25 CHF', 25],
    ['0', 0],
    ['12.5', 12.5],
  ])('parses %j as %d', (raw, expected) => {
    expect(parseChf(raw)).toEqual({ ok: true, value: expected });
  });

  it('treats empty input as no value', () => {
    expect(parseChf('  ')).toEqual({ ok: true, value: undefined });
  });

  it.each([
    ['-5', 'NEGATIVE'],
    ['abc', 'INVALID'],
    ['1.000,50', 'INVALID'],
    ['1,000.50', 'INVALID'],
    ['5.123', 'TOO_MANY_DECIMALS'],
    ['2000000', 'TOO_LARGE'],
  ])('rejects %j with %s', (raw, code) => {
    expect(parseChf(raw)).toEqual({ ok: false, error: code });
  });

  it('serialises with two decimals', () => {
    expect(chfToPlain(1000.5)).toBe('1000.50');
    expect(chfToPlain(50)).toBe('50.00');
  });
});
