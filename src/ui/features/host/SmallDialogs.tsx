import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { commonText, liveText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { TextField } from '../../design-system/Field';
import styles from './HostDialogs.module.css';

/** "42 als gezogen markieren?" before a board click commits a manual draw (FR-3). */
export function MarkDrawnDialog({
  number,
  onConfirm,
  onClose,
}: {
  readonly number: number | undefined;
  readonly onConfirm: (number: number) => void;
  readonly onClose: () => void;
}) {
  const m = t(liveText).board;
  const c = t(commonText);
  return (
    <Dialog
      open={number !== undefined}
      title={number === undefined ? '' : m.markAsDrawn(number)}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{c.actions.cancel}</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (number !== undefined) onConfirm(number);
            }}
          >
            {m.markConfirm}
          </Button>
        </>
      }
    >
      <p class={styles.hint}>{t(liveText).manual.title}</p>
    </Dialog>
  );
}

/** Pause screen with a message and an optional resume time (HH:MM). */
export function PauseDialog({
  open,
  onShow,
  onClose,
}: {
  readonly open: boolean;
  readonly onShow: (message: string, resumeAt: string | undefined) => void;
  readonly onClose: () => void;
}) {
  const m = t(liveText).pause;
  const c = t(commonText);
  const [message, setMessage] = useState(m.defaultMessage);
  const [resumeAt, setResumeAt] = useState('');
  const valid = resumeAt === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(resumeAt);
  const show = () => {
    if (!valid) return;
    onShow(
      message.trim() === '' ? m.defaultMessage : message,
      resumeAt === '' ? undefined : resumeAt,
    );
  };
  return (
    <Dialog
      open={open}
      title={m.title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{c.actions.cancel}</Button>
          <Button variant="primary" disabled={!valid} onClick={show}>
            {m.show}
          </Button>
        </>
      }
    >
      <form
        class={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          show();
        }}
      >
        <TextField
          label={m.message}
          value={message}
          onValue={setMessage}
          maxLength={120}
          autoComplete="off"
        />
        <TextField
          label={m.resumeAt}
          value={resumeAt}
          onValue={setResumeAt}
          inputMode="numeric"
          placeholder="21:30"
          maxLength={5}
          autoComplete="off"
          error={valid ? undefined : m.resumeAt}
        />
      </form>
    </Dialog>
  );
}

/** "?": keyboard overview (FR-12). */
export function ShortcutsDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const m = t(liveText).shortcuts;
  return (
    <Dialog
      open={open}
      title={m.title}
      onClose={onClose}
      actions={<Button onClick={onClose}>{t(commonText).actions.close}</Button>}
    >
      <dl class={styles.shortcuts}>
        {m.items.map(([keys, action]) => (
          <Fragment key={keys}>
            <dt>
              <kbd class={styles.key}>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </Fragment>
        ))}
      </dl>
      <p class={styles.hint}>{m.inactive}</p>
    </Dialog>
  );
}
