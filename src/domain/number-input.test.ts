import { describe, expect, it } from 'vitest';
import { parseDrawnNumber } from './number-input';

describe('parseDrawnNumber (FR-3)', () => {
  it.each([
    ['42', 42],
    ['07', 7],
    ['  12 ', 12],
    ['90', 90],
    ['1', 1],
    ['0042', 42],
  ])('accepts %j as %i', (raw, expected) => {
    expect(parseDrawnNumber(raw, 90)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', 'EMPTY'],
    ['   ', 'EMPTY'],
    ['abc', 'NOT_A_NUMBER'],
    ['4a', 'NOT_A_NUMBER'],
    ['+5', 'NOT_A_NUMBER'],
    ['4.2', 'NOT_INTEGER'],
    ['4,2', 'NOT_INTEGER'],
    ['4.', 'NOT_INTEGER'],
    ['.5', 'NOT_INTEGER'],
    ['0', 'OUT_OF_RANGE'],
    ['91', 'OUT_OF_RANGE'],
    ['-1', 'OUT_OF_RANGE'],
    ['99999999999999999999', 'OUT_OF_RANGE'],
  ])('rejects %j with %s', (raw, code) => {
    const result = parseDrawnNumber(raw, 90);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it('reports the maximum with range errors', () => {
    expect(parseDrawnNumber('76', 75)).toEqual({
      ok: false,
      error: { code: 'OUT_OF_RANGE', max: 75 },
    });
  });
});
