import { useEffect, useState } from 'preact/hooks';
import type { ActionResult } from '../../../application/host-controller';
import { activePrizeView } from '../../../application/selectors';
import { revokeLatestAward } from '../../../domain/commands';
import { roundStatus, unplayedRounds } from '../../../domain/rounds';
import { latestResolvedSlot, roundOf } from '../../../domain/state';
import { commonText, liveText } from '../../../i18n/catalogues';
import { prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { SelectField, TextField } from '../../design-system/Field';
import { showToast } from '../../design-system/toast-store';
import { errorMessage } from './error-message';
import styles from './HostDialogs.module.css';

export type OverrideAction = 'skip' | 'abort' | 'jump' | 'revoke' | 'complete';
type Action = OverrideAction;

/** Spielleitung: host overrides, each confirmed and audit-logged with a reason (FR-5, FR-4). */
export function OverridesDialog({
  open,
  onClose,
  initialAction,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly initialAction?: OverrideAction | undefined;
}) {
  const m = t(liveText).overrides;
  const c = t(commonText);
  const { app, host } = useHostServices();
  const [action, setAction] = useState<Action | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (open) setAction(initialAction);
  }, [open, initialAction]);
  const session = app.session.value;
  if (!open || session === undefined) return null;
  const game = session.game.value;
  const { settings } = session.match.value;
  const running = game.phase === 'ROUND_RUNNING';
  const view = activePrizeView(game, session.catalogue.value, settings);
  const revocable = revokeLatestAward(game, 'x').ok;
  const revokeSlot =
    game.currentRound === undefined
      ? undefined
      : latestResolvedSlot(roundOf(game, game.currentRound));
  const revokeTitle =
    game.currentRound === undefined || revokeSlot === undefined
      ? ''
      : prizeTitle(
          roundOf(game, game.currentRound).prizes[revokeSlot].award?.prize.title,
          revokeSlot,
          c,
        );
  const targets = unplayedRounds(game, settings.rounds).filter(
    (round) => roundStatus(game, round) !== 'RUNNING',
  );
  const reset = () => {
    setAction(undefined);
    setReason('');
    setTarget('');
    setError(undefined);
  };
  const close = () => {
    reset();
    onClose();
  };
  const finish = (result: ActionResult, success: string) => {
    if (!result.ok) {
      setError(errorMessage(result.error));
      return;
    }
    showToast(success, { tone: 'success' });
    close();
  };
  const submit = () => {
    if (action !== 'complete' && reason.trim() === '') {
      setError(m.reasonRequired);
      return;
    }
    switch (action) {
      case 'skip':
        finish(host.skipPrize(reason), m.skipped);
        return;
      case 'abort':
        finish(host.abortRound(reason), m.aborted);
        return;
      case 'jump':
        finish(host.jumpToRound(Number(target || targets[0]), reason), m.aborted);
        return;
      case 'revoke':
        finish(host.revokeAward(reason), m.revoked);
        return;
      case 'complete':
        finish(host.completeEvent(), m.completed);
        return;
      case undefined:
        return;
    }
  };
  const choices: readonly { key: Action; label: string; available: boolean }[] = [
    { key: 'skip', label: m.skip, available: running },
    { key: 'abort', label: m.abort, available: running },
    { key: 'jump', label: m.jump, available: game.phase !== 'COMPLETED' && targets.length > 0 },
    { key: 'revoke', label: m.revoke, available: revocable },
    { key: 'complete', label: m.complete, available: !running && game.phase !== 'COMPLETED' },
  ];
  const body: Readonly<Record<Action, string>> = {
    skip: m.skipBody(view === undefined ? '' : prizeTitle(view.prize?.title, view.slot, c)),
    abort: m.abortBody,
    jump: m.jumpBody,
    revoke: m.revokeBody(revokeTitle),
    complete: m.completeBody(unplayedRounds(game, settings.rounds).length),
  };
  return (
    <Dialog
      open={open}
      title={m.title}
      onClose={close}
      tone={action === undefined || action === 'jump' ? 'default' : 'danger'}
      actions={
        action === undefined ? (
          <Button onClick={close}>{c.actions.close}</Button>
        ) : (
          <>
            <Button onClick={reset}>{c.actions.back}</Button>
            <Button variant={action === 'jump' ? 'primary' : 'danger'} onClick={submit}>
              {c.actions.confirm}
            </Button>
          </>
        )
      }
    >
      {action === undefined ? (
        <div class={styles.choices}>
          {choices.map((choice) => (
            <Button
              key={choice.key}
              disabled={!choice.available}
              onClick={() => {
                setAction(choice.key);
                setTarget(String(targets[0] ?? ''));
              }}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      ) : (
        <form
          class={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p>{body[action]}</p>
          {action === 'jump' && (
            <SelectField
              label={m.jumpTarget}
              value={target}
              options={targets.map((round) => ({
                value: String(round),
                label: c.roundOf(round, settings.rounds),
              }))}
              onValue={setTarget}
            />
          )}
          {action !== 'complete' && (
            <TextField
              label={m.reason}
              value={reason}
              onValue={setReason}
              maxLength={200}
              error={error}
              autoComplete="off"
            />
          )}
          {action === 'complete' && error !== undefined && <p class={styles.error}>{error}</p>}
        </form>
      )}
    </Dialog>
  );
}
