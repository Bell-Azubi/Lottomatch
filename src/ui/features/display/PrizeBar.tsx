import type { ImageStore } from '../../../application/ports';
import type { DisplaySnapshot } from '../../../application/sync-messages';
import { SUPERLOTTO_SLOT } from '../../../domain/types';
import { commonText } from '../../../i18n/catalogues';
import { formatChf } from '../../../i18n/format';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { PrizeImage } from '../../design-system/PrizeImage';
import { PrizeProgress } from '../../design-system/Rings';
import { Glass } from '../../design-system/Surface';
import styles from './PrizeBar.module.css';

/** Glass prize bar: image, title (two lines, then ellipsis), win condition, progress (FR-5). */
export function PrizeBar({
  snapshot,
  images,
}: {
  readonly snapshot: DisplaySnapshot;
  readonly images: ImageStore;
}) {
  const c = t(commonText);
  const prize = snapshot.prize;
  return (
    <Glass as="footer" className={styles.bar}>
      {prize === undefined ? (
        <p class={styles.title}>
          {snapshot.round === undefined
            ? c.appName
            : c.roundOf(snapshot.round, snapshot.totalRounds)}
        </p>
      ) : (
        <>
          <PrizeImage
            images={images}
            imageId={prize.imageId}
            alt={prize.title ?? ''}
            size="display"
          />
          <div class={styles.text}>
            <p class={`${styles.title} ${prize.slot === SUPERLOTTO_SLOT ? styles.superlotto : ''}`}>
              {prizeTitle(prize.title, prize.slot, c)}
            </p>
            <p class={styles.meta}>
              <span class={styles.condition}>{conditionLabel(prize.condition, c)}</span>
              {prize.valueChf !== undefined && (
                <span class="tabular"> · {formatChf(prize.valueChf)}</span>
              )}
              {prize.sponsor !== undefined && <span> · {prize.sponsor}</span>}
            </p>
          </div>
          <div class={styles.progress}>
            <p class={styles.slot}>{c.prizeOf(prize.slot, snapshot.progress.length)}</p>
            <PrizeProgress states={snapshot.progress} compact />
          </div>
        </>
      )}
    </Glass>
  );
}
