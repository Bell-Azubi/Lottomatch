import { useSignal } from '@preact/signals';
import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { displayText } from '../../../i18n/catalogues';
import { locale, t } from '../../../i18n';
import { applyTheme } from '../../app/theme';
import { useServices } from '../../app/context';
import { Logo } from '../../design-system/Logo';
import { RoundRing } from '../../design-system/Rings';
import { Board } from '../board/Board';
import { createBoardModel } from '../board/board-state';
import styles from './DisplayPage.module.css';
import { Overlay } from './Overlays';
import { PrizeBar } from './PrizeBar';
import { Stage } from './Stage';
import { useDisplayChrome } from './useDisplayChrome';
import { useReveal } from './useReveal';

/**
 * Anzeige: read-only audience screen in its own window (FR-10). It renders the newest host
 * snapshot; with no host present, the persisted state.
 */
export default function DisplayPage() {
  const m = t(displayText);
  const { app, display } = useServices();
  const snapshot = display?.snapshot.value;
  const stageRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const view = useReveal(snapshot, stageRef, boardRef, styles.flyer);
  const drawn = useSignal<readonly number[]>([]);
  const latest = useSignal<number | undefined>(undefined);
  const maxNumber = useSignal(90);
  const board = useMemo(
    () => createBoardModel(drawn, latest, maxNumber),
    [drawn, latest, maxNumber],
  );
  const { screen } = app.platform;
  const toggleFullscreen = useCallback(() => screen.toggleFullscreen(), [screen]);
  const isFullscreen = useCallback(() => screen.isFullscreen(), [screen]);
  const { cursorHidden, fullscreen } = useDisplayChrome(toggleFullscreen, isFullscreen);

  useEffect(() => {
    const visible = (snapshot?.drawn ?? []).filter((number) => number !== view.pending);
    drawn.value = visible;
    latest.value = visible.at(-1);
    maxNumber.value = snapshot?.maxNumber ?? 90;
  }, [snapshot, view.pending, drawn, latest, maxNumber]);

  useEffect(() => {
    if (snapshot === undefined) return;
    applyTheme(snapshot.theme);
    locale.value = snapshot.locale;
    document.documentElement.lang = snapshot.locale;
    document.documentElement.dataset['performance'] = snapshot.performanceMode ? 'on' : 'off';
  }, [snapshot]);

  const lastFive = drawn.value.slice(-5).reverse();
  return (
    <main
      class={`${styles.display} ${cursorHidden ? styles.hideCursor : ''}`}
      onClick={() => {
        if (!fullscreen) void toggleFullscreen();
      }}
    >
      <h1 class="visually-hidden">{m.title}</h1>
      <div class={styles.logo}>
        <Logo size="display" />
        {snapshot?.practice === true && <span class={styles.practice}>{m.ringPractice}</span>}
      </div>
      {snapshot !== undefined && (
        <>
          <div class={styles.ring}>
            <RoundRing
              round={snapshot.round}
              total={snapshot.totalRounds}
              segments={snapshot.ring}
              size="lg"
            />
          </div>
          <div class={styles.stage}>
            <Stage snapshot={snapshot} view={view} stageRef={stageRef} lastFive={lastFive} />
          </div>
          <div class={styles.board} ref={boardRef}>
            <Board model={board} size="display" />
          </div>
          <div class={styles.bar}>
            <PrizeBar snapshot={snapshot} images={app.platform.images} />
          </div>
          {snapshot.overlay !== undefined && (
            <Overlay
              overlay={snapshot.overlay}
              images={app.platform.images}
              quiet={snapshot.performanceMode}
            />
          )}
        </>
      )}
      {!fullscreen && <p class={styles.hint}>{m.fullscreenHint}</p>}
    </main>
  );
}
