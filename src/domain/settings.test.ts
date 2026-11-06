import { describe, expect, it } from 'vitest';
import { apply, drawAll, RULES, startedState } from '../test/domain-builders';
import {
  checkSettingsChange,
  defaultSettings,
  highestStartedRound,
  isIsoDate,
  rulesOf,
  validateSettings,
  type MatchSettings,
} from './settings';
import { initialGameState } from './state';

const base = defaultSettings('Lottomatch 2026', '2026-11-07');
const fields = (settings: MatchSettings) =>
  validateSettings(settings).map((i) => `${i.field}:${i.code}`);

describe('defaults', () => {
  it('match the brief: 24 rounds, 1–90, 3 × 5 cards, template 1/1/2/full', () => {
    expect(base).toMatchObject({
      rounds: 24,
      maxNumber: 90,
      perLine: 5,
      lines: 3,
      boardReset: 'ROUND',
    });
    expect(base.template[1]).toEqual({ kind: 'ONE_LINE' });
    expect(base.template[3]).toEqual({ kind: 'ONE_LINE' });
    expect(base.template[4]).toEqual({ kind: 'ONE_LINE' });
    expect(base.lateClaimPolicy).toBe('HOST_DECIDES');
    expect(base.tiePolicy).toBe('TIEBREAK');
    expect(validateSettings(base)).toEqual([]);
    expect(rulesOf(base)).toEqual(RULES);
  });
});

describe('validateSettings', () => {
  it('checks text fields', () => {
    expect(fields({ ...base, name: '  ' })).toEqual(['name:REQUIRED']);
    expect(fields({ ...base, name: 'x'.repeat(81) })).toEqual(['name:TOO_LONG']);
    expect(fields({ ...base, venue: 'y'.repeat(81) })).toEqual(['venue:TOO_LONG']);
  });

  it('checks dates', () => {
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('07.11.2026')).toBe(false);
    expect(fields({ ...base, date: '2026-13-01' })).toEqual(['date:INVALID_DATE']);
    expect(fields({ ...base, date: '' })).toEqual([]);
  });

  it('checks numeric ranges and the card size', () => {
    expect(fields({ ...base, rounds: 0 })).toEqual(['rounds:OUT_OF_RANGE']);
    expect(fields({ ...base, rounds: 51 })).toEqual(['rounds:OUT_OF_RANGE']);
    expect(fields({ ...base, maxNumber: 29 })).toEqual(['maxNumber:OUT_OF_RANGE']);
    expect(fields({ ...base, maxNumber: 100 })).toEqual(['maxNumber:OUT_OF_RANGE']);
    expect(fields({ ...base, perLine: 2.5 })).toEqual(['perLine:OUT_OF_RANGE']);
    expect(fields({ ...base, lines: 7 })).toEqual(['lines:OUT_OF_RANGE']);
    expect(fields({ ...base, maxNumber: 30, perLine: 9, lines: 4 })).toEqual([
      'cardSize:CARD_TOO_LARGE',
    ]);
  });

  it('checks the template, sponsors and payout', () => {
    const template = { ...base.template, 2: { kind: 'CUSTOM' as const, label: ' ' } };
    expect(fields({ ...base, template })).toEqual(['template:INVALID_CONDITION']);
    expect(fields({ ...base, sponsors: Array.from({ length: 21 }, () => 'A') })).toEqual([
      'sponsors:TOO_MANY',
    ]);
    expect(fields({ ...base, sponsors: [''] })).toEqual(['sponsors:TOO_LONG']);
    expect(fields({ ...base, payout: { enabled: true, minRatioPercent: 0 } })).toEqual([
      'payout:OUT_OF_RANGE',
    ]);
    expect(
      fields({ ...base, payout: { enabled: true, minRatioPercent: 50, stakesChf: -1 } }),
    ).toEqual(['payout:OUT_OF_RANGE']);
    expect(
      fields({ ...base, payout: { enabled: true, minRatioPercent: 50, stakesChf: 4000 } }),
    ).toEqual([]);
  });
});

describe('checkSettingsChange (I6)', () => {
  it('locks N, card layout and board reset while a round runs', () => {
    const running = startedState();
    const next = { ...base, maxNumber: 75, perLine: 4, lines: 2, boardReset: 'PRIZE' as const };
    const codes = checkSettingsChange(running, base, next).map((i) => `${i.field}:${i.code}`);
    expect(codes).toEqual([
      'maxNumber:LOCKED_WHILE_RUNNING',
      'perLine:LOCKED_WHILE_RUNNING',
      'lines:LOCKED_WHILE_RUNNING',
      'boardReset:LOCKED_WHILE_RUNNING',
    ]);
    expect(checkSettingsChange(initialGameState(), base, next)).toEqual([]);
  });

  it('keeps R at or above the highest started round', () => {
    const state = apply(drawAll(startedState(RULES, 7), [1]), [
      { type: 'ROUND_ABORTED', round: 7, reason: 'x' },
    ]);
    expect(highestStartedRound(state)).toBe(7);
    expect(checkSettingsChange(state, base, { ...base, rounds: 6 })).toEqual([
      { field: 'rounds', code: 'BELOW_PLAYED_ROUND' },
    ]);
    expect(checkSettingsChange(state, base, { ...base, rounds: 7 })).toEqual([]);
  });
});
