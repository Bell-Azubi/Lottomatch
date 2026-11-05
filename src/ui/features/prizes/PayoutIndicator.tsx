import { payoutSummary } from '../../../application/payout';
import type { Catalogue } from '../../../domain/catalogue';
import type { MatchSettings } from '../../../domain/settings';
import { formatChf } from '../../../i18n/format';
import { t } from '../../../i18n';
import { Icon } from '../../design-system/Icon';
import styles from './PrizesPage.module.css';
import { prizesText } from './text';

/** Payout-ratio indicator (Could): only shown when enabled in the event settings. */
export function PayoutIndicator({
  settings,
  catalogue,
}: {
  readonly settings: MatchSettings;
  readonly catalogue: Catalogue;
}) {
  const m = t(prizesText);
  const summary = payoutSummary(catalogue, settings);
  if (summary === undefined) return null;
  return (
    <section class={styles.payout} aria-labelledby="payout-title">
      <h2 id="payout-title" class={styles.payoutTitle}>
        {m.payout.title}
      </h2>
      <p class="tabular">{m.payout.total(formatChf(summary.total))}</p>
      {summary.stakes === undefined || summary.ratioPercent === undefined ? (
        <p>{m.payout.noStakes}</p>
      ) : (
        <>
          <p class="tabular">{m.payout.stakes(formatChf(summary.stakes))}</p>
          <p class="tabular">
            {m.payout.ratio(summary.ratioPercent.toFixed(1), summary.minRatioPercent)}
          </p>
          <p class={summary.meetsMinimum === true ? styles.payoutOk : styles.payoutBelow}>
            <Icon name={summary.meetsMinimum === true ? 'check' : 'alert'} size={18} />
            {summary.meetsMinimum === true ? m.payout.meets : m.payout.below}
          </p>
        </>
      )}
    </section>
  );
}
