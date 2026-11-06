import { describe, expect, it } from 'vitest';
import { conditionChoices, sameCondition, textLength, validateWinCondition } from './win-condition';
import { hasPersonalData, normaliseWinner, redactWinner } from './winner';

describe('winners', () => {
  it('normalises input and drops empty fields', () => {
    expect(
      normaliseWinner({ cardNo: ' 17 ', name: '  ', note: undefined, validSinceSeq: 4 }),
    ).toEqual({
      cardNo: '17',
      validSinceSeq: 4,
    });
    expect(normaliseWinner({ name: ' Anna   Muster ', note: 'Tisch 3' })).toEqual({
      name: 'Anna Muster',
      note: 'Tisch 3',
    });
  });

  it('detects and redacts personal data', () => {
    const winner = { cardNo: '17', name: 'Anna', note: 'x', validSinceSeq: 3 };
    expect(hasPersonalData(winner)).toBe(true);
    expect(redactWinner(winner)).toEqual({ cardNo: '17', validSinceSeq: 3 });
    expect(hasPersonalData(redactWinner(winner))).toBe(false);
  });
});

describe('win conditions', () => {
  it('offers 2 Reihen only where it is already stored (ADR-0026)', () => {
    expect(conditionChoices('ONE_LINE')).toEqual(['ONE_LINE', 'FULL_CARD', 'CUSTOM']);
    expect(conditionChoices('CUSTOM')).toEqual(['ONE_LINE', 'FULL_CARD', 'CUSTOM']);
    expect(conditionChoices('TWO_LINES')).toEqual(['ONE_LINE', 'FULL_CARD', 'CUSTOM', 'TWO_LINES']);
  });

  it('compares and validates conditions', () => {
    expect(sameCondition({ kind: 'ONE_LINE' }, { kind: 'ONE_LINE' })).toBe(true);
    expect(sameCondition({ kind: 'ONE_LINE' }, { kind: 'FULL_CARD' })).toBe(false);
    expect(sameCondition({ kind: 'CUSTOM', label: 'a' }, { kind: 'CUSTOM', label: 'a' })).toBe(
      true,
    );
    expect(sameCondition({ kind: 'CUSTOM', label: 'a' }, { kind: 'CUSTOM', label: 'b' })).toBe(
      false,
    );
    expect(validateWinCondition({ kind: 'CUSTOM', label: 'x'.repeat(61) })).toBe(false);
    expect(validateWinCondition({ kind: 'TWO_LINES' })).toBe(true);
  });

  it('counts code points, not UTF-16 units', () => {
    expect(textLength('Präsentkorb')).toBe(11);
    expect(textLength('🎁🎁')).toBe(2);
  });
});
