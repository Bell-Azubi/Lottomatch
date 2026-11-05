import type { ActivePrizeView } from '../../../application/selectors';
import type { PrizeProgress as ProgressState } from '../../../application/sync-messages';
import type { ImageStore } from '../../../application/ports';
import type { RingSegment } from '../../../domain/rounds';
import { commonText, liveText } from '../../../i18n/catalogues';
import { formatChf } from '../../../i18n/format';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { PrizeImage } from '../../design-system/PrizeImage';
import { PrizeProgress, RoundRing } from '../../design-system/Rings';
import styles from './HostStatus.module.css';

export interface HostStatusProps {
  readonly round: number | undefined;
  readonly totalRounds: number;
  readonly ring: readonly RingSegment[];
  readonly view: ActivePrizeView | undefined;
  readonly progress: readonly ProgressState[];
  readonly phaseText: string | undefined;
  readonly images: ImageStore;
}

/** "Runde 7 von 24", the active prize and the round's prize progress (FR-5, always visible). */
export function HostStatus({
  round,
  totalRounds,
  ring,
  view,
  progress,
  phaseText,
  images,
}: HostStatusProps) {
  const c = t(commonText);
  const m = t(liveText);
  const prize = view?.prize;
  return (
    <section class={styles.status} aria-label={m.status.prize}>
      <div class={styles.topRow}>
        <RoundRing round={round} total={totalRounds} segments={ring} />
        <div>
          <p class="visually-hidden">{m.status.progress}</p>
          <PrizeProgress states={progress} compact />
        </div>
      </div>
      {view === undefined ? (
        <p class={styles.phase}>{phaseText}</p>
      ) : (
        <div class={`${styles.prize} ${view.main ? styles.main : ''}`}>
          <p class={styles.slot}>
            {c.prizeOfFour(view.slot)} · {conditionLabel(view.condition, c)}
          </p>
          <div class={styles.prizeRow}>
            <PrizeImage
              images={images}
              imageId={prize?.imageId}
              alt={prize?.title ?? ''}
              size="sm"
            />
            <div>
              <p class={styles.title}>{prizeTitle(prize?.title, view.slot, c)}</p>
              {prize?.valueChf !== undefined && (
                <p class={`${styles.meta} tabular`}>
                  {m.status.value}: {formatChf(prize.valueChf)}
                </p>
              )}
              {prize?.sponsor !== undefined && (
                <p class={styles.meta}>{m.status.sponsor(prize.sponsor)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
