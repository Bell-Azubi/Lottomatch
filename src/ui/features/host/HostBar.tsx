import type { DisplayStatus } from '../../../application/host-link';
import { liveText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { Icon } from '../../design-system/Icon';
import styles from './HostBar.module.css';

export interface HostBarProps {
  readonly display: DisplayStatus;
  readonly paused: boolean;
  readonly nextRound: number | undefined;
  readonly canStart: boolean;
  readonly readOnly: boolean;
  readonly onOpenDisplay: () => void;
  readonly onPause: () => void;
  readonly onStartRound: () => void;
  readonly onOverrides: () => void;
  readonly onFullscreen: () => void;
  readonly onShortcuts: () => void;
}

/** Bottom bar: display connection, Anzeige öffnen, Pause, Runde starten and host overrides. */
export function HostBar(props: HostBarProps) {
  const m = t(liveText).bar;
  const { display } = props;
  const statusText = !display.connected
    ? m.displayMissing
    : display.synced
      ? m.displayConnected
      : m.displaySyncing;
  return (
    <div class={`${styles.bar} no-print`}>
      <p class={styles.display} role="status">
        <span
          class={`${styles.dot} ${display.connected ? styles.dotOn : styles.dotOff}`}
          aria-hidden="true"
        />
        {statusText}
      </p>
      <div class={styles.actions}>
        <Button onClick={props.onOpenDisplay}>
          <Icon name="monitor" size={20} />
          {m.openDisplay}
        </Button>
        <Button onClick={props.onPause} disabled={props.readOnly} aria-pressed={props.paused}>
          {props.paused ? m.endPause : m.pause}
        </Button>
        {props.canStart && props.nextRound !== undefined && (
          <Button variant="primary" onClick={props.onStartRound} disabled={props.readOnly}>
            {m.startRoundN(props.nextRound)}
          </Button>
        )}
        <Button onClick={props.onOverrides} disabled={props.readOnly}>
          <Icon name="menu" size={20} />
          {m.more}
        </Button>
        <Button onClick={props.onFullscreen} aria-label={m.fullscreen} title={m.fullscreen}>
          <Icon name="expand" size={20} />
        </Button>
        <Button onClick={props.onShortcuts} aria-label={m.shortcuts} title={m.shortcuts}>
          <Icon name="keyboard" size={20} />
        </Button>
      </div>
    </div>
  );
}
