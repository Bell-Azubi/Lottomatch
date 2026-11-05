import { computed } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import type { ActionResult } from '../../../application/host-controller';
import type { MatchSession } from '../../../application/session';
import {
  activePrizeView,
  effectiveMaxNumber,
  lastNumbers,
  latestDraw,
  poolNumbers,
  prizeProgress,
} from '../../../application/selectors';
import { undoLastDraw } from '../../../domain/commands';
import { parseDrawnNumber } from '../../../domain/number-input';
import { nextRound, roundRing } from '../../../domain/rounds';
import { activePool, remainingNumbers } from '../../../domain/state';
import { liveText, startText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Ball } from '../../design-system/Rings';
import { Panel, Plate } from '../../design-system/Surface';
import { showToast } from '../../design-system/toast-store';
import { Board } from '../board/Board';
import { createBoardModel } from '../board/board-state';
import { ClaimDialog } from '../claim/ClaimDialog';
import { useStartRound } from '../start/useStartRound';
import { DrawPanel } from './DrawPanel';
import { errorMessage } from './error-message';
import { HostBar } from './HostBar';
import { HostStatus } from './HostStatus';
import { clearBuffer, manualBuffer, manualError } from './manual-buffer';
import { ManualEntry } from './ManualEntry';
import { OverridesDialog, type OverrideAction } from './OverridesDialog';
import { RoundSummary } from './RoundSummary';
import { MarkDrawnDialog, PauseDialog, ShortcutsDialog } from './SmallDialogs';
import { useHostKeyboard } from './useHostKeyboard';
import styles from './HostPage.module.css';

type DialogName = 'claim' | 'overrides' | 'pause' | 'shortcuts';

function HostConsole({ session }: { readonly session: MatchSession }) {
  const m = t(liveText);
  const { app, host, hostLink } = useHostServices();
  const [dialog, setDialog] = useState<DialogName | undefined>(undefined);
  const [overrideAction, setOverrideAction] = useState<OverrideAction | undefined>(undefined);
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const board = useMemo(
    () =>
      createBoardModel(
        computed(() => poolNumbers(session.game.value).map((d) => d.number)),
        computed(() => latestDraw(session.game.value)?.number),
        computed(() => effectiveMaxNumber(session.game.value, session.match.value.settings)),
      ),
    [session],
  );
  const { request: requestStart, dialog: gapDialog } = useStartRound();
  const game = session.game.value;
  const { settings } = session.match.value;
  const readOnly = hostLink.control.value !== 'CONTROLLING';
  const running = game.phase === 'ROUND_RUNNING';
  const pool = activePool(game);
  const maxNumber = effectiveMaxNumber(game, settings);
  const latest = latestDraw(game);
  const overlay = host.overlays.state.value;
  const upcoming = nextRound(game, settings.rounds);
  const poolMode = pool?.rules.boardReset ?? settings.boardReset;
  const spinBlocked = readOnly
    ? m.readOnlyHint
    : !running
      ? m.draw.noRound
      : pool !== undefined && remainingNumbers(pool).length === 0
        ? m.draw.poolEmpty
        : undefined;
  const undoCheck = undoLastDraw(game);
  const undoBlocked = readOnly
    ? m.readOnlyHint
    : undoCheck.ok
      ? undefined
      : errorMessage(undoCheck.error);
  const report = (result: ActionResult<unknown>) => {
    if (!result.ok) showToast(errorMessage(result.error, poolMode), { tone: 'error' });
  };
  const spin = () => {
    if (spinBlocked !== undefined) return;
    report(host.spin());
  };
  const commitManual = (raw: string) => {
    if (readOnly || !running) return;
    const parsed = parseDrawnNumber(raw, maxNumber);
    if (!parsed.ok) {
      const errors = m.manual.errors;
      manualError.value =
        parsed.error.code === 'OUT_OF_RANGE'
          ? errors.OUT_OF_RANGE(parsed.error.max)
          : errors[parsed.error.code];
      return;
    }
    const result = host.drawManual(parsed.value);
    if (!result.ok) {
      manualError.value = errorMessage(result.error, poolMode);
      return;
    }
    clearBuffer();
  };
  const undo = () => {
    if (undoBlocked !== undefined || latest === undefined) return;
    const number = latest.number;
    const result = host.undo();
    if (result.ok) showToast(m.draw.undone(number));
    else report(result);
  };
  const openDisplay = () => {
    void app.platform.screen.openDisplay(`${window.location.pathname}#/display`).then((result) => {
      if (result === 'BLOCKED') showToast(m.bar.popupBlocked, { tone: 'error' });
    });
  };
  const togglePause = () => {
    if (!readOnly) host.overlays.togglePause(m.pause.defaultMessage);
  };
  const openOverrides = (action?: OverrideAction) => {
    setOverrideAction(action);
    setDialog('overrides');
  };
  useHostKeyboard({
    spin,
    commitManual: () => {
      commitManual(manualBuffer.value);
    },
    undo,
    checkWin: () => {
      if (running && !readOnly) setDialog('claim');
    },
    togglePause,
    openDisplay,
    fullscreen: () => void app.platform.screen.toggleFullscreen(),
    help: () => {
      setDialog('shortcuts');
    },
  });
  const phaseText =
    game.phase === 'READY'
      ? m.status.notStarted
      : game.phase === 'COMPLETED'
        ? m.status.completed
        : m.status.betweenRounds;
  const close = () => {
    setDialog(undefined);
  };
  return (
    <div class={styles.console}>
      <Plate className={styles.plate} aria-label={t(startText).activeEvent}>
        <div class={styles.statusArea}>
          <HostStatus
            round={game.currentRound}
            totalRounds={settings.rounds}
            ring={roundRing(game, settings.rounds)}
            view={activePrizeView(game, session.catalogue.value, settings)}
            progress={prizeProgress(game)}
            phaseText={phaseText}
            images={app.platform.images}
          />
        </div>
        {running ? (
          <>
            <DrawPanel
              latest={latest}
              reveal={host.reveal.state.value}
              spinBlocked={spinBlocked}
              undoBlocked={undoBlocked}
              onSpin={spin}
              onUndo={undo}
              onCheckWin={() => {
                setDialog('claim');
              }}
              checkDisabled={readOnly}
            />
            <ManualEntry disabled={readOnly} onCommit={commitManual} />
          </>
        ) : (
          <div class={styles.summaryArea}>
            <RoundSummary
              onStartRound={requestStart}
              onComplete={() => {
                openOverrides('complete');
              }}
              readOnly={readOnly}
            />
          </div>
        )}
      </Plate>
      <section class={styles.boardArea} aria-label={m.board.label}>
        <Board model={board} {...(readOnly || !running ? {} : { onPick: setPicked })} />
        <div class={styles.boardFooter}>
          <p class={`${styles.counter} tabular`}>
            {m.board.counter(board.drawnCount.value, maxNumber)}
          </p>
          <ol class={styles.lastNumbers} aria-label={m.board.lastNumbers}>
            {lastNumbers(game).map((number) => (
              <li key={number} class={styles.lastBall}>
                <Ball number={number} />
                <span class="visually-hidden">{number}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div class={styles.barArea}>
        <HostBar
          display={hostLink.display.value}
          paused={overlay?.kind === 'PAUSE'}
          nextRound={upcoming}
          canStart={!running && game.phase !== 'COMPLETED'}
          readOnly={readOnly}
          onOpenDisplay={openDisplay}
          onPause={() => {
            if (overlay?.kind === 'PAUSE') host.overlays.hideAll();
            else setDialog('pause');
          }}
          onStartRound={requestStart}
          onOverrides={() => {
            openOverrides();
          }}
          onFullscreen={() => void app.platform.screen.toggleFullscreen()}
          onShortcuts={() => {
            setDialog('shortcuts');
          }}
        />
      </div>
      <p class="visually-hidden" aria-live="polite">
        {latest === undefined ? '' : m.announce.drawn(latest.number, latest.seq)}
      </p>
      <ClaimDialog open={dialog === 'claim'} onClose={close} />
      <OverridesDialog
        open={dialog === 'overrides'}
        onClose={close}
        initialAction={overrideAction}
      />
      <PauseDialog
        open={dialog === 'pause'}
        onClose={close}
        onShow={(message, resumeAt) => {
          host.overlays.showPause(message, resumeAt);
          close();
        }}
      />
      <ShortcutsDialog open={dialog === 'shortcuts'} onClose={close} />
      <MarkDrawnDialog
        number={picked}
        onClose={() => {
          setPicked(undefined);
        }}
        onConfirm={(number) => {
          setPicked(undefined);
          const result = host.drawManual(number);
          report(result);
        }}
      />
      {gapDialog}
    </div>
  );
}

/** Spiel: the caller's console (FR-1 to FR-7, FR-12). */
export default function HostPage() {
  const { app } = useHostServices();
  const session = app.session.value;
  if (session === undefined) {
    return (
      <Panel>
        <p>{t(startText).noEvent}</p>
      </Panel>
    );
  }
  return <HostConsole key={session.matchId} session={session} />;
}
