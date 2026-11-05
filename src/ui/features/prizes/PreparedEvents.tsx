import { useState } from 'preact/hooks';
import type { ImportError, ImportPreview } from '../../../application/backup-import';
import { commitImport } from '../../../application/backup-import';
import {
  loadManifest,
  loadPreparedEvent,
  type PreparedEventEntry,
  type PreparedEventError,
} from '../../../application/prepared-events';
import { commonText } from '../../../i18n/catalogues';
import { formatCalendarDate } from '../../../i18n/format';
import { t } from '../../../i18n';
import type { PrizesMessages } from '../../../i18n/de-CH/prizes';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { showToast } from '../../design-system/toast-store';
import formStyles from './PrizeForm.module.css';
import styles from './PrizesPage.module.css';
import { prizesText } from './text';

/** Message for a failed import of a prepared event file. */
export function importErrorText(error: ImportError, m: PrizesMessages): string {
  const texts = m.prepared.importErrors;
  switch (error.code) {
    case 'INVALID':
      return texts.INVALID(error.path);
    case 'INVALID_PRIZES':
      return texts.INVALID_PRIZES(error.count);
    case 'LOG_CORRUPT':
      return texts.LOG_CORRUPT(error.seq);
    case 'NOT_JSON':
    case 'FOREIGN':
    case 'TOO_NEW':
    case 'UNSUPPORTED':
    case 'CHECKSUM_MISMATCH':
    case 'INVALID_SETTINGS':
      return texts[error.code];
  }
}

function preparedErrorText(error: PreparedEventError, m: PrizesMessages): string {
  if (error.code === 'IMPORT') return importErrorText(error.error, m);
  return error.code === 'UNAVAILABLE' ? m.prepared.unavailable : m.prepared.invalid;
}

/** One-click loading of prepared event files shipped in `public/events/` (FR-8). */
export function PreparedEvents({ readOnly }: { readonly readOnly: boolean }) {
  const m = t(prizesText);
  const c = t(commonText);
  const { app, admin } = useHostServices();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<readonly PreparedEventEntry[] | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<ImportPreview | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const show = async () => {
    setOpen(true);
    setEntries(undefined);
    setPreview(undefined);
    setProblem(undefined);
    const result = await loadManifest(app.platform);
    if (result.ok) setEntries(result.value);
    else setProblem(preparedErrorText(result.error, m));
  };
  const select = async (entry: PreparedEventEntry) => {
    setBusy(true);
    setProblem(undefined);
    const result = await loadPreparedEvent(app.platform, entry);
    setBusy(false);
    if (result.ok) setPreview(result.value);
    else setProblem(preparedErrorText(result.error, m));
  };
  const confirm = async (current: ImportPreview) => {
    setBusy(true);
    const result = await commitImport(app, admin, current.file);
    setBusy(false);
    if (!result.ok) {
      showToast(result.error === 'READ_ONLY' ? m.errors.READ_ONLY : m.prepared.loadFailed, {
        tone: 'error',
      });
      return;
    }
    showToast(m.prepared.loaded(current.name), { tone: 'success' });
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
  };
  return (
    <>
      <Button disabled={readOnly} onClick={() => void show()}>
        {m.prepared.open}
      </Button>
      <Dialog
        open={open}
        title={preview === undefined ? m.prepared.title : m.prepared.previewTitle(preview.name)}
        size="lg"
        onClose={close}
        actions={
          <>
            <Button
              onClick={
                preview === undefined
                  ? close
                  : () => {
                      setPreview(undefined);
                    }
              }
            >
              {preview === undefined ? c.actions.close : c.actions.back}
            </Button>
            {preview !== undefined && (
              <Button variant="primary" disabled={busy} onClick={() => void confirm(preview)}>
                {m.prepared.confirm}
              </Button>
            )}
          </>
        }
      >
        {preview === undefined ? (
          <>
            <p>{m.prepared.hint}</p>
            {entries === undefined && problem === undefined && (
              <p role="status">{m.prepared.loading}</p>
            )}
            {entries?.length === 0 && <p>{m.prepared.none}</p>}
            {entries !== undefined && entries.length > 0 && (
              <ul class={styles.preparedList}>
                {entries.map((entry) => (
                  <li key={entry.file} class={styles.preparedItem}>
                    <span>
                      <strong>{entry.name}</strong>
                      {entry.description !== undefined && (
                        <span class={styles.hint}> {entry.description}</span>
                      )}
                    </span>
                    <Button disabled={busy} onClick={() => void select(entry)}>
                      {m.prepared.preview}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p>{m.prepared.previewBody}</p>
            <p>
              <strong>{preview.name}</strong>
              {preview.date === '' ? '' : ` · ${formatCalendarDate(preview.date)}`}
            </p>
            <p>{m.prepared.facts(preview.rounds, preview.prizes)}</p>
          </>
        )}
        {problem !== undefined && (
          <p class={formStyles.error} role="alert">
            {problem}
          </p>
        )}
      </Dialog>
    </>
  );
}
