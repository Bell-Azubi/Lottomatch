import { useId, useState } from 'preact/hooks';
import {
  commitImport,
  previewImport,
  type ImportError,
  type ImportPreview,
} from '../../../application/backup-import';
import type { SettingsDataMessages } from '../../../i18n/de-CH/settings-data';
import { commonText } from '../../../i18n/catalogues';
import { formatCalendarDate } from '../../../i18n/format';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { showToast } from '../../design-system/toast-store';
import { settingsDataText } from './messages';
import styles from './Settings.module.css';

/** Specific message for every import failure (FR-9 import with validation). */
export function importErrorText(error: ImportError, m: SettingsDataMessages): string {
  const e = m.data.importErrors;
  switch (error.code) {
    case 'NOT_JSON':
      return e.NOT_JSON;
    case 'FOREIGN':
      return e.FOREIGN;
    case 'TOO_NEW':
      return e.TOO_NEW(error.version);
    case 'UNSUPPORTED':
      return e.UNSUPPORTED(error.version);
    case 'CHECKSUM_MISMATCH':
      return e.CHECKSUM_MISMATCH;
    case 'INVALID':
      return e.INVALID(error.path);
    case 'INVALID_SETTINGS':
      return e.INVALID_SETTINGS;
    case 'INVALID_PRIZES':
      return e.INVALID_PRIZES(error.count);
    case 'LOG_CORRUPT':
      return e.LOG_CORRUPT(error.seq);
  }
}

function PreviewFacts({ preview }: { readonly preview: ImportPreview }) {
  const d = t(settingsDataText).data;
  return (
    <dl class={styles.facts}>
      <dt>{d.previewName}</dt>
      <dd>{preview.name}</dd>
      <dt>{d.previewDate}</dt>
      <dd>{preview.date === '' ? '–' : formatCalendarDate(preview.date)}</dd>
      <dt>{d.previewKind}</dt>
      <dd>{d.previewKinds[preview.kind]}</dd>
      <dt>{d.previewRounds}</dt>
      <dd>{preview.rounds}</dd>
      <dt>{d.previewPrizes}</dt>
      <dd>{preview.prizes}</dd>
      <dt>{d.previewImages}</dt>
      <dd>{preview.images}</dd>
      <dt>{d.previewLog}</dt>
      <dd>{preview.logEntries}</dd>
      <dt>{d.previewAwards}</dt>
      <dd>{preview.awards}</dd>
      <dt>{d.previewChecksum}</dt>
      <dd>{preview.checksum === 'VERIFIED' ? d.checksumVerified : d.checksumAbsent}</dd>
    </dl>
  );
}

/** Import of a backup or prepared event file: validate, preview, then create a new event. */
export function ImportPanel({ canEdit }: { readonly canEdit: boolean }) {
  const m = t(settingsDataText);
  const c = t(commonText);
  const { app, admin, host } = useHostServices();
  const inputId = useId();
  const [preview, setPreview] = useState<ImportPreview | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const read = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (file === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await previewImport(await file.text(), (text) =>
        app.platform.crypto.sha256Hex(text),
      );
      if (result.ok) setPreview(result.value);
      else setError(importErrorText(result.error, m));
    } catch (failure: unknown) {
      app.platform.reportError(failure, 'settings:import');
      setError(m.data.importFailed);
    } finally {
      setBusy(false);
      input.value = '';
    }
  };
  const confirm = async (current: ImportPreview) => {
    setBusy(true);
    const result = await commitImport(app, admin, current.file);
    setBusy(false);
    setPreview(undefined);
    if (!result.ok) {
      showToast(m.data.importFailed, { tone: 'error' });
      return;
    }
    host.overlays.hideAll();
    host.reveal.clear();
    showToast(m.data.imported(result.value.settings.name), { tone: 'success' });
  };
  return (
    <div class={styles.itemMain}>
      <h3 class={styles.subTitle}>{m.data.import}</h3>
      <p class={styles.hint}>{m.data.importHint}</p>
      <label for={inputId}>{m.data.chooseFile}</label>
      <input
        id={inputId}
        type="file"
        accept=".json,application/json"
        class={styles.fileInput}
        disabled={!canEdit || busy}
        aria-describedby={error === undefined ? undefined : `${inputId}-error`}
        onChange={(event) => {
          void read(event.currentTarget);
        }}
      />
      {busy && <p role="status">{m.data.reading}</p>}
      {error !== undefined && (
        <p id={`${inputId}-error`} class={styles.errorText} role="alert">
          {error}
        </p>
      )}
      {preview !== undefined && (
        <Dialog
          open
          title={m.data.previewTitle}
          onClose={() => {
            setPreview(undefined);
          }}
          actions={
            <>
              <Button
                onClick={() => {
                  setPreview(undefined);
                }}
              >
                {c.actions.cancel}
              </Button>
              <Button
                variant="primary"
                disabled={busy || !canEdit}
                onClick={() => {
                  void confirm(preview);
                }}
              >
                {m.data.importConfirm}
              </Button>
            </>
          }
        >
          <PreviewFacts preview={preview} />
          {preview.migratedFrom !== undefined && <p>{m.data.migrated(preview.migratedFrom)}</p>}
        </Dialog>
      )}
    </div>
  );
}
