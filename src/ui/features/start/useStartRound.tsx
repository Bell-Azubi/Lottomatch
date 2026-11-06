import { useState } from 'preact/hooks';
import { findGaps, type RoundGaps } from '../../../domain/catalogue';
import { commonText, startText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { showToast } from '../../design-system/toast-store';
import { errorMessage } from '../host/error-message';

/**
 * "Gang starten" with the FR-8 gap check: starting the event while prizes are missing lists the
 * gaps and asks for confirmation once.
 */
export function useStartRound(onStarted?: () => void) {
  const { app, host } = useHostServices();
  const [gaps, setGaps] = useState<readonly RoundGaps[]>([]);
  const start = () => {
    const result = host.startRound();
    if (!result.ok) showToast(errorMessage(result.error), { tone: 'error' });
    else onStarted?.();
    setGaps([]);
  };
  const request = () => {
    const session = app.session.value;
    if (session === undefined) return;
    const firstStart = session.game.value.phase === 'READY';
    const found = firstStart
      ? findGaps(session.catalogue.value, session.match.value.settings.rounds)
      : [];
    if (found.length > 0) setGaps(found);
    else start();
  };
  const m = t(startText);
  const c = t(commonText);
  const dialog = (
    <Dialog
      open={gaps.length > 0}
      title={m.gapsConfirm.title}
      onClose={() => {
        setGaps([]);
      }}
      actions={
        <>
          <Button
            onClick={() => {
              setGaps([]);
            }}
          >
            {c.actions.cancel}
          </Button>
          <Button variant="primary" onClick={start}>
            {m.gapsConfirm.confirm}
          </Button>
        </>
      }
    >
      <p>{m.gapsConfirm.body}</p>
      <ul>
        {gaps.slice(0, 12).map((gap) => (
          <li key={gap.round}>
            {m.gapsConfirm.round(gap.round, gap.slots.map((slot) => c.prizeSlot(slot)).join(', '))}
          </li>
        ))}
        {gaps.length > 12 && <li>…</li>}
      </ul>
    </Dialog>
  );
  return { request, dialog };
}
