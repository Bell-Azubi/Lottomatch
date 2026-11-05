import { totalPrizeValue, type Catalogue } from '../domain/catalogue';
import type { MatchSettings } from '../domain/settings';

export interface PayoutSummary {
  /** Sum of the CHF values of the prizes in rounds 1–R. */
  readonly total: number;
  readonly stakes?: number;
  /** Prize value as a percentage of the stakes, rounded to one decimal. */
  readonly ratioPercent?: number;
  readonly minRatioPercent: number;
  readonly meetsMinimum?: boolean;
}

/**
 * Payout-ratio indicator (FR-8, Could): total prize value against the entered stakes, compared
 * with a configurable minimum because cantonal permit conditions vary. `undefined` when off.
 */
export function payoutSummary(
  catalogue: Catalogue,
  settings: MatchSettings,
): PayoutSummary | undefined {
  const { payout } = settings;
  if (!payout.enabled) return undefined;
  const total = totalPrizeValue(catalogue, settings.rounds);
  const stakes = payout.stakesChf;
  if (stakes === undefined || stakes <= 0)
    return { total, minRatioPercent: payout.minRatioPercent };
  const ratioPercent = Math.round((total / stakes) * 1_000) / 10;
  return {
    total,
    stakes,
    ratioPercent,
    minRatioPercent: payout.minRatioPercent,
    meetsMinimum: ratioPercent >= payout.minRatioPercent,
  };
}
