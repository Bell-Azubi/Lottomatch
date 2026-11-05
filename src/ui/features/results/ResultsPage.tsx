import { useEffect, useMemo, useState } from 'preact/hooks';
import { auditEntries } from '../../../application/audit';
import { computeResults } from '../../../application/results';
import { filterRounds, type RoundFilter } from '../../../application/results-output';
import type { MatchSession } from '../../../application/session';
import type { LogEnvelope, PrizeSlot } from '../../../domain/types';
import { commonText } from '../../../i18n/catalogues';
import { formatCalendarDate } from '../../../i18n/format';
import { prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { useHostServices, type HostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { SelectField, Toggle } from '../../design-system/Field';
import { Panel } from '../../design-system/Surface';
import { showToast } from '../../design-system/toast-store';
import { errorMessage } from '../host/error-message';
import { AuditLog } from './AuditLog';
import { CorrectionDialog } from './CorrectionDialog';
import { downloadResultsJson, downloadWinnersCsv } from './exports';
import type { PrizeActions } from './PrizeRow';
import { PrintWinnerList } from './PrintWinnerList';
import styles from './Results.module.css';
import { RoundResults } from './RoundResults';
import { resultsText } from './text';
import { TotalsPanel } from './TotalsPanel';

interface Editing {
  readonly round: number;
  readonly slot: PrizeSlot;
}

/** The session log is appended in place; `version` identifies its content for memoisation. */
function logAt(
  session: MatchSession,
  version: number,
): { version: number; log: readonly LogEnvelope[] } {
  return { version, log: [...session.log] };
}

/** Prints after the print scope has rendered; resets the scope once the dialog closes. */
function usePrinting(services: HostServices) {
  const { clock } = services.app.platform;
  const [scope, setScope] = useState<number | 'ALL'>('ALL');
  const [printedAt, setPrintedAt] = useState(() => clock.nowIso());
  const [request, setRequest] = useState(0);
  useEffect(() => {
    const before = () => {
      setPrintedAt(clock.nowIso());
    };
    const after = () => {
      setScope('ALL');
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, [clock]);
  useEffect(() => {
    if (request > 0) window.print();
  }, [request]);
  const print = (next: number | 'ALL') => {
    setScope(next);
    setPrintedAt(clock.nowIso());
    setRequest((count) => count + 1);
  };
  return { scope, printedAt, print };
}

function ResultsView({
  services,
  session,
}: {
  readonly services: HostServices;
  readonly session: MatchSession;
}) {
  const { app, host, hostLink } = services;
  const m = t(resultsText);
  const c = t(commonText);
  const version = session.logVersion.value;
  const game = session.game.value;
  const catalogue = session.catalogue.value;
  const match = session.match.value;
  const { settings } = match;
  const logState = useMemo(() => logAt(session, version), [session, version]);
  const results = useMemo(
    () => computeResults({ game, log: logState.log, catalogue, settings }),
    [game, logState, catalogue, settings],
  );
  const entries = useMemo(() => auditEntries(logState.log), [logState]);
  const [filter, setFilter] = useState<RoundFilter>('PLAYED');
  const [openOnly, setOpenOnly] = useState(false);
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const [correctionError, setCorrectionError] = useState<string | undefined>(undefined);
  const printing = usePrinting(services);
  const actions: PrizeActions = {
    canEdit: hostLink.control.value === 'CONTROLLING',
    onHandout: (round, slot, status) => {
      const result = host.setHandout(round, slot, status);
      if (!result.ok) showToast(errorMessage(result.error), { tone: 'error' });
    },
    onCorrect: (round, slot) => {
      setCorrectionError(undefined);
      setEditing({ round, slot });
    },
  };
  const visible = filterRounds(results.rounds, filter, openOnly);
  const printRounds =
    printing.scope === 'ALL'
      ? results.rounds
      : results.rounds.filter((round) => round.round === printing.scope);
  const editingPrize =
    editing === undefined
      ? undefined
      : results.rounds
          .find((round) => round.round === editing.round)
          ?.prizes.find((prize) => prize.slot === editing.slot);
  const date = settings.date === '' ? '' : formatCalendarDate(settings.date);
  return (
    <div class={styles.page}>
      <div class={styles.screenOnly}>
        <header class={styles.header}>
          <h1>{m.title}</h1>
          <p class={styles.eventLine}>
            <span>{m.eventLine(settings.name, date)}</span>
            {match.kind === 'PRACTICE' && <span class={styles.practice}>{c.practiceBadge}</span>}
          </p>
        </header>
        <TotalsPanel totals={results.totals} />
        <Panel className={styles.section} aria-labelledby="results-rounds-title">
          <div class={styles.sectionHeader}>
            <h2 id="results-rounds-title">{m.rounds.title}</h2>
            <div class={styles.actions} role="group" aria-label={m.exports.title}>
              <Button
                onClick={() => {
                  printing.print('ALL');
                }}
              >
                {m.print.all}
              </Button>
              <Button
                onClick={() => {
                  downloadWinnersCsv(app, match, results, m, c);
                  showToast(m.exports.done, { tone: 'success' });
                }}
              >
                {m.exports.csv}
              </Button>
              <Button
                onClick={() => {
                  downloadResultsJson(app, match, results);
                  showToast(m.exports.done, { tone: 'success' });
                }}
              >
                {m.exports.json}
              </Button>
            </div>
          </div>
          <p class={styles.privacy}>{m.exports.privacy}</p>
          <div class={styles.controls}>
            <SelectField
              label={m.rounds.show}
              value={filter}
              options={[
                { value: 'PLAYED', label: m.rounds.played },
                { value: 'ALL', label: m.rounds.all },
              ]}
              onValue={setFilter}
            />
            <Toggle label={m.rounds.openOnly} checked={openOnly} onChange={setOpenOnly} />
          </div>
          {visible.length === 0 ? (
            <p>{openOnly ? m.rounds.emptyOpen : m.rounds.empty}</p>
          ) : (
            <ol class={styles.roundList}>
              {visible.map((summary) => (
                <RoundResults
                  key={summary.round}
                  summary={summary}
                  actions={actions}
                  onPrint={printing.print}
                />
              ))}
            </ol>
          )}
        </Panel>
        <AuditLog
          entries={entries}
          verify={async () => {
            await app.queue.flush();
            return app.platform.events.verify(session.matchId);
          }}
        />
      </div>
      <PrintWinnerList rounds={printRounds} settings={settings} printedAt={printing.printedAt} />
      {editing !== undefined && editingPrize !== undefined && (
        <CorrectionDialog
          key={`${editing.round}-${editing.slot}`}
          prizeLabel={`${m.round.title(editing.round)}, ${prizeTitle(editingPrize.title, editing.slot, c)}`}
          winners={editingPrize.winners}
          error={correctionError}
          onClose={() => {
            setEditing(undefined);
          }}
          onSave={(winners, reason) => {
            const result = host.correctWinners(editing.round, editing.slot, winners, reason);
            if (!result.ok) {
              setCorrectionError(errorMessage(result.error));
              return;
            }
            setEditing(undefined);
            showToast(m.correction.saved, { tone: 'success' });
          }}
        />
      )}
    </div>
  );
}

/** Auswertung (FR-11): results per round, totals, Gabentisch list, exports and audit log. */
export default function ResultsPage() {
  const services = useHostServices();
  const session = services.app.session.value;
  const m = t(resultsText);
  if (session === undefined) {
    return (
      <Panel>
        <h1>{m.title}</h1>
        <p>{m.noEvent}</p>
      </Panel>
    );
  }
  return <ResultsView key={session.matchId} services={services} session={session} />;
}
