import type { RefObject } from 'preact';
import type { DisplaySnapshot } from '../../../application/sync-messages';
import { SUPERLOTTO_SLOT } from '../../../domain/types';
import { displayText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { BadgeRing } from '../../design-system/BadgeRing';
import { Ball } from '../../design-system/Rings';
import { Drum } from './Drum';
import styles from './Stage.module.css';
import type { RevealView } from './useReveal';

export interface StageProps {
  readonly snapshot: DisplaySnapshot;
  readonly view: RevealView;
  readonly stageRef: RefObject<HTMLElement>;
  /** Numbers shown as small balls, newest first (excludes a number still flying in). */
  readonly lastFive: readonly number[];
}

/**
 * The solid half of the split field: the latest number assembled into a badge, ringed with
 * "RUNDE 7 VON 24" and "ZIEHUNG 37" (SUPERLOTTO in red, ÜBUNG in practice), and the last five.
 */
export function Stage({ snapshot, view, stageRef, lastFive }: StageProps) {
  const m = t(displayText);
  const superlotto = snapshot.prize?.slot === SUPERLOTTO_SLOT;
  const topText = snapshot.practice
    ? m.ringPractice
    : superlotto
      ? m.ringSuperlotto
      : snapshot.round === undefined
        ? undefined
        : m.ringTop(snapshot.round, snapshot.totalRounds);
  const shown = view.shown;
  return (
    <section ref={stageRef} class={styles.stage} aria-label={m.latest}>
      <div class={styles.glow} aria-hidden="true" />
      <div class={styles.badgeSlot}>
        {view.phase === 'DRUM' ? (
          <Drum seed={view.drumSeed} />
        ) : (
          <div class={styles.badge} data-reveal="badge">
            <BadgeRing
              variant="badge"
              topText={topText}
              bottomText={shown === undefined ? undefined : m.ringBottom(shown.seq)}
              bandTone={superlotto ? 'red' : 'graphite'}
              numeral={shown === undefined ? undefined : String(shown.number)}
            />
          </div>
        )}
      </div>
      <p class={shown === undefined ? styles.waiting : 'visually-hidden'}>
        {shown === undefined ? m.waiting : m.latestNumber(shown.number, shown.seq)}
      </p>
      <ol class={styles.lastFive} aria-label={m.latest}>
        {lastFive.map((number) => (
          <li key={number} class={styles.lastBall}>
            <Ball number={number} />
            <span class="visually-hidden">{number}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
