import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOGUE, upsertPrize } from '../domain/catalogue';
import { defaultSettings } from '../domain/settings';
import { payoutSummary } from './payout';

const settings = defaultSettings('Lottomatch');
const catalogue = upsertPrize(
  upsertPrize(EMPTY_CATALOGUE, {
    id: 'a',
    round: 1,
    slot: 1,
    title: 'A',
    valueChf: 600,
    winCondition: { kind: 'ONE_LINE' },
  }),
  { id: 'b', round: 30, slot: 1, title: 'B', valueChf: 999, winCondition: { kind: 'ONE_LINE' } },
);

describe('payoutSummary', () => {
  it('is off by default', () => {
    expect(payoutSummary(catalogue, settings)).toBeUndefined();
  });

  it('shows the total until stakes are entered', () => {
    const enabled = { ...settings, payout: { enabled: true, minRatioPercent: 50 } };
    expect(payoutSummary(catalogue, enabled)).toEqual({ total: 600, minRatioPercent: 50 });
    const zero = { ...settings, payout: { enabled: true, minRatioPercent: 50, stakesChf: 0 } };
    expect(payoutSummary(catalogue, zero)).toEqual({ total: 600, minRatioPercent: 50 });
  });

  it('compares the ratio with the minimum', () => {
    const met = { ...settings, payout: { enabled: true, minRatioPercent: 50, stakesChf: 1000 } };
    expect(payoutSummary(catalogue, met)).toEqual({
      total: 600,
      stakes: 1000,
      ratioPercent: 60,
      minRatioPercent: 50,
      meetsMinimum: true,
    });
    const below = { ...settings, payout: { enabled: true, minRatioPercent: 70, stakesChf: 1500 } };
    expect(payoutSummary(catalogue, below)).toMatchObject({
      ratioPercent: 40,
      meetsMinimum: false,
    });
  });
});
