import { useEffect, useState } from 'preact/hooks';
import type { ImageStore } from '../../../application/ports';
import type { DisplayOverlay } from '../../../application/sync-messages';
import { commonText, displayText } from '../../../i18n/catalogues';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { Logo } from '../../design-system/Logo';
import { PrizeImage } from '../../design-system/PrizeImage';
import { Glass } from '../../design-system/Surface';
import { celebrate } from './confetti';
import { prefersReducedMotion } from './motion';
import styles from './Overlays.module.css';

type Win = Extract<DisplayOverlay, { kind: 'WIN' }>;
type RoundEnd = Extract<DisplayOverlay, { kind: 'ROUND_END' }>;
type Pause = Extract<DisplayOverlay, { kind: 'PAUSE' }>;

function WinOverlay({ overlay, quiet }: { readonly overlay: Win; readonly quiet: boolean }) {
  const m = t(displayText);
  const c = t(commonText);
  useEffect(() => {
    if (quiet || prefersReducedMotion()) return undefined;
    let cleanup: (() => void) | undefined;
    let active = true;
    void celebrate(overlay.superlotto, styles.confetti)
      .then((dispose) => {
        if (active) cleanup = dispose;
        else dispose();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      cleanup?.();
    };
  }, [overlay.id, overlay.superlotto, quiet]);
  return (
    <div class={`${styles.content} ${overlay.superlotto ? styles.superlottoWin : ''}`}>
      <p class={styles.headline}>{overlay.superlotto ? m.win.superlottoTitle : m.win.title}</p>
      <p class={styles.prize}>{prizeTitle(overlay.title, overlay.slot, c)}</p>
      <p class={styles.sub}>{conditionLabel(overlay.condition, c)}</p>
      <ul class={styles.winners}>
        {overlay.winners.map((winner, index) => (
          <li key={index} class={styles.winner}>
            {winner.name ?? (winner.cardNo === undefined ? '' : m.win.card(winner.cardNo))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoundEndOverlay({
  overlay,
  images,
}: {
  readonly overlay: RoundEnd;
  readonly images: ImageStore;
}) {
  const m = t(displayText);
  const c = t(commonText);
  return (
    <div class={styles.content}>
      <p class={styles.headline}>{m.roundEnd.title(overlay.round)}</p>
      {overlay.next === undefined ? (
        <p class={styles.sub}>{m.roundEnd.allPlayed}</p>
      ) : (
        <>
          <p class={styles.sub}>{m.roundEnd.next(overlay.next.round)}</p>
          <ol class={styles.nextPrizes}>
            {overlay.next.prizes.map((prize) => (
              <li key={prize.slot} class={styles.nextPrize}>
                <PrizeImage
                  images={images}
                  imageId={prize.imageId}
                  alt={prize.title ?? ''}
                  size="display"
                />
                <span class={styles.nextSlot}>{c.prizeSlot(prize.slot)}</span>
                <span class={styles.nextTitle}>{prizeTitle(prize.title, prize.slot, c)}</span>
                <span class={styles.nextCondition}>{conditionLabel(prize.condition, c)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

const CAROUSEL_MS = 5_000;

function PauseOverlay({ overlay }: { readonly overlay: Pause }) {
  const m = t(displayText);
  const [index, setIndex] = useState(0);
  const rotate = overlay.sponsors.length > 1 && !prefersReducedMotion();
  useEffect(() => {
    if (!rotate) return undefined;
    const timer = setInterval(() => {
      setIndex((value) => (value + 1) % overlay.sponsors.length);
    }, CAROUSEL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [rotate, overlay.sponsors.length]);
  return (
    <div class={styles.content}>
      <Logo size="display" />
      <p class={styles.headline}>{overlay.message}</p>
      {overlay.resumeAt !== undefined && (
        <p class={`${styles.sub} tabular`}>{m.pause.resume(overlay.resumeAt)}</p>
      )}
      {overlay.sponsors.length > 0 && (
        <div class={styles.sponsors}>
          <p class={styles.sponsorsTitle}>{m.pause.sponsors}</p>
          {rotate ? (
            <p key={index} class={styles.sponsor}>
              {overlay.sponsors[index]}
            </p>
          ) : (
            <ul class={styles.sponsorList}>
              {overlay.sponsors.map((sponsor) => (
                <li key={sponsor}>{sponsor}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Host-triggered overlays on the display (FR-10): Gewinn, Ende des Gangs, Pause, Spielende. */
export function Overlay({
  overlay,
  images,
  quiet,
}: {
  readonly overlay: DisplayOverlay;
  readonly images: ImageStore;
  readonly quiet: boolean;
}) {
  const m = t(displayText);
  const label =
    overlay.kind === 'WIN'
      ? m.win.title
      : overlay.kind === 'ROUND_END'
        ? m.roundEnd.title(overlay.round)
        : overlay.kind === 'PAUSE'
          ? overlay.message
          : m.gameEnd.title;
  return (
    <section class={styles.layer} aria-label={label}>
      <Glass className={styles.panel}>
        {overlay.kind === 'WIN' && <WinOverlay overlay={overlay} quiet={quiet} />}
        {overlay.kind === 'ROUND_END' && <RoundEndOverlay overlay={overlay} images={images} />}
        {overlay.kind === 'PAUSE' && <PauseOverlay overlay={overlay} />}
        {overlay.kind === 'GAME_END' && (
          <div class={styles.content}>
            <Logo size="display" />
            <p class={styles.headline}>{m.gameEnd.title}</p>
            <p class={styles.sub}>{overlay.name}</p>
          </div>
        )}
      </Glass>
    </section>
  );
}
