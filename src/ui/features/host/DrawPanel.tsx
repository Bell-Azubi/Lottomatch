import { useEffect, useState } from 'preact/hooks';
import type { Reveal } from '../../../application/reveal';
import { REVEAL_SETTLE_MS } from '../../../application/reveal';
import { liveText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { BadgeRing } from '../../design-system/BadgeRing';
import { NeuButton } from '../../design-system/NeuButton';
import styles from './DrawPanel.module.css';

export interface DrawPanelProps {
  readonly latest: { readonly number: number; readonly seq: number } | undefined;
  readonly reveal: Reveal | undefined;
  /** Why Drehen is unavailable, or undefined when it can be pressed. */
  readonly spinBlocked: string | undefined;
  readonly undoBlocked: string | undefined;
  readonly onSpin: () => void;
  readonly onUndo: () => void;
  readonly onCheckWin: () => void;
  readonly checkDisabled: boolean;
}

function useSpinning(reveal: Reveal | undefined): boolean {
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (reveal === undefined || reveal.instant || reveal.durationMs === 0) {
      setSpinning(false);
      return undefined;
    }
    setSpinning(true);
    const timer = setTimeout(() => {
      setSpinning(false);
    }, reveal.durationMs + REVEAL_SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [reveal]);
  return spinning;
}

/** Result well, Drehen disc with progress arc, Rückgängig and Gewinn prüfen (FR-2, FR-4). */
export function DrawPanel({
  latest,
  reveal,
  spinBlocked,
  undoBlocked,
  onSpin,
  onUndo,
  onCheckWin,
  checkDisabled,
}: DrawPanelProps) {
  const m = t(liveText);
  const spinning = useSpinning(reveal);
  return (
    <div class={styles.panel}>
      <div class={styles.well} aria-live="off">
        <span class={styles.wellLabel}>{m.draw.latest}</span>
        <span class={`${styles.wellNumber} tabular`}>
          {latest === undefined ? '–' : latest.number}
        </span>
        <span class={`${styles.wellSeq} tabular`}>
          {latest === undefined ? '' : m.draw.drawSeq(latest.seq)}
        </span>
      </div>
      <div class={styles.spinWrap}>
        <NeuButton
          shape="disc"
          className={styles.spin}
          disabled={spinBlocked !== undefined}
          aria-describedby={spinBlocked === undefined ? undefined : 'spin-blocked'}
          onClick={onSpin}
        >
          <span class={styles.spinRing} aria-hidden="true">
            {spinning && reveal !== undefined ? (
              <BadgeRing key={reveal.key} variant="ring" sweepMs={reveal.durationMs} />
            ) : (
              <BadgeRing variant="ring" />
            )}
          </span>
          <span class={styles.spinLabel}>{spinning ? m.draw.revealNow : m.draw.spin}</span>
        </NeuButton>
      </div>
      {spinBlocked !== undefined && (
        <p id="spin-blocked" class={styles.reason}>
          {spinBlocked}
        </p>
      )}
      <div class={styles.actions}>
        <NeuButton
          disabled={undoBlocked !== undefined}
          title={undoBlocked}
          aria-describedby={undoBlocked === undefined ? undefined : 'undo-blocked'}
          onClick={onUndo}
        >
          {m.draw.undo}
        </NeuButton>
        <NeuButton disabled={checkDisabled} onClick={onCheckWin}>
          {m.bar.checkWin}
        </NeuButton>
      </div>
      {undoBlocked !== undefined && (
        <p id="undo-blocked" class={styles.reason}>
          {undoBlocked}
        </p>
      )}
    </div>
  );
}
