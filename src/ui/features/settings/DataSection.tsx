import { useState } from 'preact/hooks';
import { downloadBackup } from '../../../application/backup-export';
import { commonText } from '../../../i18n/catalogues';
import { formatDateTime } from '../../../i18n/format';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { TextField } from '../../design-system/Field';
import { showToast } from '../../design-system/toast-store';
import { ImportPanel } from './ImportPanel';
import { settingsDataText, settingsText } from './messages';
import { Section } from './Section';
import styles from './Settings.module.css';

type Confirm = 'erase' | 'reset' | undefined;

/** Daten: backup export, import, delete all winner names (C6) and reset the event (FR-9). */
export function DataSection({ canEdit }: { readonly canEdit: boolean }) {
  const m = t(settingsDataText);
  const c = t(commonText);
  const s = t(settingsText);
  const { app, admin, host } = useHostServices();
  const [confirm, setConfirm] = useState<Confirm>(undefined);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const lastBackup = app.session.value?.match.value.lastBackupAt;
  const close = () => {
    setConfirm(undefined);
    setTyped('');
  };
  const exportBackup = async () => {
    setBusy(true);
    try {
      if (await downloadBackup(app)) showToast(m.data.exported, { tone: 'success' });
    } catch (failure: unknown) {
      app.platform.reportError(failure, 'settings:export');
      showToast(c.unexpectedError, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const erase = async () => {
    setBusy(true);
    const result = await admin.erasePersonalData();
    setBusy(false);
    close();
    if (result.ok) showToast(m.data.erased(result.value), { tone: 'success' });
    else showToast(s.events.errors[result.error], { tone: 'error' });
  };
  const reset = async () => {
    setBusy(true);
    const result = await admin.resetActive();
    setBusy(false);
    close();
    if (!result.ok) {
      showToast(s.events.errors[result.error], { tone: 'error' });
      return;
    }
    host.overlays.hideAll();
    host.reveal.clear();
    showToast(m.data.resetDone, { tone: 'success' });
  };
  return (
    <Section id="data" title={s.sections.data} intro={m.data.intro}>
      <div class={styles.itemMain}>
        <h3 class={styles.subTitle}>{m.data.export}</h3>
        <p class={styles.hint}>{m.data.exportHint}</p>
        <p>
          {lastBackup === undefined
            ? m.data.noBackup
            : m.data.lastBackup(formatDateTime(lastBackup))}
        </p>
        <div class={styles.actions}>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              void exportBackup();
            }}
          >
            {m.data.export}
          </Button>
        </div>
      </div>
      <ImportPanel canEdit={canEdit} />
      <div class={styles.itemMain}>
        <h3 class={styles.subTitle}>{m.data.eraseNames}</h3>
        <p class={styles.hint}>{m.data.eraseHint}</p>
        <div class={styles.actions}>
          <Button
            variant="danger"
            disabled={!canEdit || busy}
            onClick={() => {
              setConfirm('erase');
            }}
          >
            {m.data.eraseNames}
          </Button>
        </div>
      </div>
      <div class={styles.itemMain}>
        <h3 class={styles.subTitle}>{m.data.reset}</h3>
        <p class={styles.hint}>{m.data.resetHint}</p>
        <div class={styles.actions}>
          <Button
            variant="danger"
            disabled={!canEdit || busy}
            onClick={() => {
              setConfirm('reset');
            }}
          >
            {m.data.reset}
          </Button>
        </div>
      </div>
      <Dialog
        open={confirm === 'erase'}
        tone="danger"
        title={m.data.eraseTitle}
        onClose={close}
        actions={
          <>
            <Button onClick={close}>{c.actions.cancel}</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                void erase();
              }}
            >
              {m.data.eraseConfirm}
            </Button>
          </>
        }
      >
        <p>{m.data.eraseBody}</p>
      </Dialog>
      <Dialog
        open={confirm === 'reset'}
        tone="danger"
        title={m.data.resetTitle}
        onClose={close}
        actions={
          <>
            <Button onClick={close}>{c.actions.cancel}</Button>
            <Button
              variant="danger"
              disabled={busy || typed.trim() !== m.data.resetWord}
              onClick={() => {
                void reset();
              }}
            >
              {m.data.resetConfirm}
            </Button>
          </>
        }
      >
        <p>{m.data.resetBody}</p>
        <div class={styles.actions}>
          <Button
            disabled={busy}
            onClick={() => {
              void exportBackup();
            }}
          >
            {m.data.export}
          </Button>
        </div>
        <TextField label={m.data.resetPrompt} value={typed} onValue={setTyped} autoComplete="off" />
      </Dialog>
    </Section>
  );
}
