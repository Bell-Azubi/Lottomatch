import { useId, useState } from 'preact/hooks';
import { buildPreview, type CsvPreview } from '../../../application/prize-csv';
import type { PrizeEditor } from '../../../application/prize-editor';
import { isAwarded } from '../../../application/selectors';
import { commonText } from '../../../i18n/catalogues';
import { formatChf } from '../../../i18n/format';
import { conditionLabel } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { showToast } from '../../design-system/toast-store';
import formStyles from './PrizeForm.module.css';
import styles from './PrizesPage.module.css';
import { prizesText } from './text';

const MAX_LISTED = 100;

function PreviewTables({ preview }: { readonly preview: CsvPreview }) {
  const m = t(prizesText);
  const c = t(commonText);
  return (
    <>
      <p class={styles.summary} role="status">
        {m.csv.summary(preview.rows.length, preview.total)}
      </p>
      {preview.errors.length > 0 && (
        <section aria-labelledby="csv-errors">
          <h3 id="csv-errors">{m.csv.errorsTitle}</h3>
          <ul class={styles.errorList}>
            {preview.errors.slice(0, MAX_LISTED).map((error) => (
              <li key={`${error.line}-${error.code}`}>
                {m.csv.row(error.line, m.csv.rowErrors[error.code])}
              </li>
            ))}
            {preview.errors.length > MAX_LISTED && <li>…</li>}
          </ul>
        </section>
      )}
      {preview.rows.length > 0 && (
        <section aria-labelledby="csv-valid" class={styles.previewScroll}>
          <h3 id="csv-valid">{m.csv.validTitle}</h3>
          <table class={styles.previewTable}>
            <thead>
              <tr>
                <th scope="col">{m.csv.columns.round}</th>
                <th scope="col">{m.csv.columns.slot}</th>
                <th scope="col">{m.csv.columns.title}</th>
                <th scope="col">{m.csv.columns.condition}</th>
                <th scope="col">{m.csv.columns.value}</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, MAX_LISTED).map((row) => (
                <tr key={`${row.round}-${row.slot}`}>
                  <td class="tabular">{row.round}</td>
                  <td>{c.prizeSlot(row.slot)}</td>
                  <td>{row.draft.title}</td>
                  <td>{conditionLabel(row.draft.winCondition, c)}</td>
                  <td class="tabular">
                    {row.draft.valueChf === undefined ? '' : formatChf(row.draft.valueChf)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

/** CSV import with a row-level preview before anything is committed (FR-8). */
export function CsvImport({
  editor,
  readOnly,
}: {
  readonly editor: PrizeEditor;
  readonly readOnly: boolean;
}) {
  const m = t(prizesText);
  const c = t(commonText);
  const { app } = useHostServices();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const reset = () => {
    setPreview(undefined);
    setProblem(undefined);
  };
  const read = async (file: File) => {
    const session = app.session.value;
    if (session === undefined) return;
    setBusy(true);
    reset();
    try {
      const table = await app.platform.csv.parse(await file.text());
      if (table.rows.length === 0) {
        setProblem(m.csv.empty);
        return;
      }
      const { settings } = session.match.value;
      const game = session.game.value;
      const result = buildPreview(table.rows, table.headers, {
        totalRounds: settings.rounds,
        template: settings.template,
        locked: (round, slot) => isAwarded(game, round, slot),
      });
      if (result.mapping.missing.length > 0) {
        setProblem(
          m.csv.missingColumns(
            result.mapping.missing.map((column) => m.csv.columns[column]).join(', '),
          ),
        );
        return;
      }
      setPreview(result);
    } catch (error: unknown) {
      app.platform.reportError(error, 'csv-import');
      setProblem(m.csv.unreadable);
    } finally {
      setBusy(false);
    }
  };
  const commit = () => {
    if (preview === undefined) return;
    const result = editor.importPrizes(preview.rows);
    if (!result.ok) {
      showToast(m.errors[result.error.code], { tone: 'error' });
      return;
    }
    showToast(m.csv.imported(result.value.imported), { tone: 'success' });
    setOpen(false);
    reset();
  };
  const close = () => {
    setOpen(false);
    reset();
  };
  return (
    <>
      <Button
        disabled={readOnly}
        onClick={() => {
          setOpen(true);
        }}
      >
        {m.csv.import}
      </Button>
      <Dialog
        open={open}
        title={m.csv.title}
        size="lg"
        onClose={close}
        actions={
          <>
            <Button onClick={close}>{c.actions.cancel}</Button>
            <Button
              variant="primary"
              disabled={preview === undefined || preview.rows.length === 0}
              onClick={commit}
            >
              {m.csv.commit(preview?.rows.length ?? 0)}
            </Button>
          </>
        }
      >
        <p>{m.csv.hint}</p>
        <div class={formStyles.imageActions}>
          <input
            id={inputId}
            class={formStyles.fileInput}
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              input.value = '';
              if (file !== undefined) void read(file);
            }}
          />
          <label class={formStyles.fileButton} for={inputId}>
            {busy ? m.csv.reading : m.csv.file}
          </label>
        </div>
        {problem !== undefined && (
          <p class={formStyles.error} role="alert">
            {problem}
          </p>
        )}
        {preview !== undefined && <PreviewTables preview={preview} />}
      </Dialog>
    </>
  );
}
