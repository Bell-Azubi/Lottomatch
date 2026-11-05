import { useMemo, useState } from 'preact/hooks';
import { zurichDate } from '../../../application/app-store';
import { slugify } from '../../../application/backup-format';
import { exportTable } from '../../../application/prize-csv';
import { PrizeEditor } from '../../../application/prize-editor';
import { findGaps } from '../../../domain/catalogue';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Panel } from '../../design-system/Surface';
import { showToast } from '../../design-system/toast-store';
import { BulkTools } from './BulkTools';
import { CsvImport } from './CsvImport';
import { PayoutIndicator } from './PayoutIndicator';
import { PreparedEvents } from './PreparedEvents';
import { PrintList } from './PrintList';
import { PrizeMatrix } from './PrizeMatrix';
import styles from './PrizesPage.module.css';
import { RoundEditor } from './RoundEditor';
import { prizesText } from './text';

/** Preise (FR-8): matrix, round editor, bulk tools, CSV, prepared events, print, payout. */
export default function PrizesPage() {
  const m = t(prizesText);
  const { app, hostLink } = useHostServices();
  const editor = useMemo(() => new PrizeEditor(app), [app]);
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const session = app.session.value;
  if (session === undefined) {
    return (
      <Panel>
        <h1>{m.title}</h1>
        <p>{m.errors.NO_EVENT}</p>
      </Panel>
    );
  }
  const { settings } = session.match.value;
  const catalogue = session.catalogue.value;
  const game = session.game.value;
  const readOnly = hostLink.control.value !== 'CONTROLLING';
  const missing = findGaps(catalogue, settings.rounds).reduce(
    (sum, gap) => sum + gap.slots.length,
    0,
  );
  const round = selected !== undefined && selected <= settings.rounds ? selected : undefined;
  const exportCsv = () => {
    const { headers, rows } = exportTable(catalogue);
    const { csv, binary, screen, clock } = app.platform;
    const text = csv.serialize(headers, rows);
    const name = `preise-${slugify(settings.name)}-${zurichDate(clock.nowIso())}.csv`;
    screen.download(name, binary.textToBlob(text, 'text/csv;charset=utf-8'));
    showToast(m.csv.exported, { tone: 'success' });
  };
  return (
    <div class={styles.page}>
      <div class="no-print">
        <h1>{m.title}</h1>
        <p class={styles.hint}>{m.intro(settings.rounds)}</p>
        {readOnly && (
          <p class={styles.readOnly} role="status">
            {m.readOnly}
          </p>
        )}
      </div>
      <section class={`${styles.toolbar} no-print`} aria-label={m.toolbar}>
        <CsvImport editor={editor} readOnly={readOnly} />
        <Button onClick={exportCsv}>{m.csv.export}</Button>
        <PreparedEvents readOnly={readOnly} />
        <Button
          onClick={() => {
            window.print();
          }}
        >
          {m.print.button}
        </Button>
        <BulkTools editor={editor} rounds={settings.rounds} selected={round} readOnly={readOnly} />
      </section>
      <PayoutIndicator settings={settings} catalogue={catalogue} />
      <div class={`${styles.layout} no-print`}>
        <Panel className={styles.matrix}>
          <p class={styles.gapSummary} role="status">
            {missing === 0 ? m.matrix.allComplete : m.matrix.totalGaps(missing)}
          </p>
          <PrizeMatrix
            rounds={settings.rounds}
            catalogue={catalogue}
            game={game}
            selected={round}
            onSelect={setSelected}
          />
        </Panel>
        {round !== undefined && (
          <RoundEditor
            round={round}
            catalogue={catalogue}
            template={settings.template}
            game={game}
            editor={editor}
            images={app.platform.images}
            readOnly={readOnly}
            onClose={() => {
              setSelected(undefined);
            }}
          />
        )}
      </div>
      <PrintList
        settings={settings}
        catalogue={catalogue}
        printedAt={app.platform.clock.nowIso()}
      />
    </div>
  );
}
