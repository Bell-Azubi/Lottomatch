import type { ResultsTotals } from '../../../application/results';
import { formatChf, formatInteger } from '../../../i18n/format';
import { t } from '../../../i18n';
import { Panel } from '../../design-system/Surface';
import styles from './Results.module.css';
import { resultsText } from './text';

/** Event totals (FR-11): rounds, prizes, value awarded, draws and false claims. */
export function TotalsPanel({ totals }: { readonly totals: ResultsTotals }) {
  const m = t(resultsText).totals;
  const items: readonly (readonly [string, string])[] = [
    [m.roundsPlayed, m.roundsValue(totals.roundsCompleted, totals.rounds)],
    [m.roundsAborted, formatInteger(totals.roundsAborted)],
    [m.roundRunning, formatInteger(totals.roundsRunning)],
    [m.prizesAwarded, formatInteger(totals.prizesAwarded)],
    [m.prizesSkipped, formatInteger(totals.prizesSkipped)],
    [m.prizesOpen, formatInteger(totals.prizesOpen)],
    [m.winners, formatInteger(totals.winners)],
    [m.handedOut, formatInteger(totals.handedOut)],
    [m.value, formatChf(totals.valueAwardedChf)],
    [m.draws, formatInteger(totals.draws)],
    // Only events from before ADR-0025 can hold false claims.
    ...(totals.falseClaims > 0
      ? ([[m.falseClaims, formatInteger(totals.falseClaims)]] as const)
      : []),
  ];
  return (
    <Panel className={styles.section} aria-labelledby="results-totals-title">
      <h2 id="results-totals-title">{m.title}</h2>
      <dl class={styles.totals}>
        {items.map(([label, value]) => (
          <div key={label} class={styles.total}>
            <dt class={styles.totalLabel}>{label}</dt>
            <dd class={styles.totalValue}>{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
