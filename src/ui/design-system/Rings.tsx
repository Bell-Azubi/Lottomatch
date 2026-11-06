import type { PrizeProgress as ProgressState } from '../../application/sync-messages';
import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { BadgeRing, type SegmentState } from './BadgeRing';
import styles from './Rings.module.css';

/** Round ring: one segment per round, always beside the text "Gang 7 von 24". */
export function RoundRing({
  round,
  total,
  segments,
  size = 'md',
}: {
  readonly round: number | undefined;
  readonly total: number;
  readonly segments: readonly SegmentState[];
  readonly size?: 'md' | 'lg';
}) {
  const m = t(commonText);
  const done = segments.filter((s) => s === 'DONE').length;
  return (
    <div class={`${styles.roundRing} ${size === 'lg' ? styles.roundRingLarge : ''}`}>
      <span class={styles.ringGraphic}>
        <BadgeRing variant="ring" segments={segments} />
      </span>
      <span class={styles.ringText}>
        <strong class="tabular">
          {round === undefined ? m.ringSummary(done, total) : m.roundOf(round, total)}
        </strong>
      </span>
    </div>
  );
}

/** Progress of a round's prizes: awarded Gold, active Cream ring, upcoming Graphite, skipped ruled. */
export function PrizeProgress({
  states,
  compact = false,
}: {
  readonly states: readonly ProgressState[];
  readonly compact?: boolean;
}) {
  const m = t(commonText);
  return (
    <ol class={`${styles.progress} ${compact ? styles.progressCompact : ''}`}>
      {states.map((state, index) => {
        const slot = index + 1;
        return (
          <li key={slot} class={styles.progressItem}>
            <span class={`${styles.disc} ${styles[`disc${state}`]}`} aria-hidden="true">
              {m.prizeDisc(slot)}
            </span>
            <span class={compact ? 'visually-hidden' : styles.progressLabel}>
              {m.prizeSlot(slot)}: {m.progress[state]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Small numbered ball (last numbers). */
export function Ball({ number, label }: { readonly number: number; readonly label?: string }) {
  return (
    <span class={styles.ball} title={label}>
      <BadgeRing variant="ball" numeral={String(number)} />
    </span>
  );
}
