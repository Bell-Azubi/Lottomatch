import { useId } from 'preact/hooks';
import type { RoundSummary } from '../../../application/results';
import type { ResultsMessages } from '../../../i18n/de-CH/results';
import { formatDuration, formatTime } from '../../../i18n/format';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { Panel } from '../../design-system/Surface';
import { PrizeRow, type PrizeActions } from './PrizeRow';
import styles from './Results.module.css';
import { resultsText } from './text';

/** Notes under a round heading: abort reason, resumed runs, false claims, revocations. */
function roundNotes(summary: RoundSummary, m: ResultsMessages): string[] {
  const notes: string[] = [];
  if (summary.abortReason !== undefined) notes.push(m.round.aborted(summary.abortReason));
  if (summary.runs > 1) notes.push(m.round.resumed(summary.runs));
  if (summary.falseClaims > 0) notes.push(m.round.falseClaims(summary.falseClaims));
  if (summary.revokedAwards > 0) notes.push(m.round.revoked(summary.revokedAwards));
  return notes;
}

/** Results of one round with its four prizes (FR-11). */
export function RoundResults({
  summary,
  actions,
  onPrint,
}: {
  readonly summary: RoundSummary;
  readonly actions: PrizeActions;
  readonly onPrint: (round: number) => void;
}) {
  const m = t(resultsText);
  const headingId = useId();
  const notes = roundNotes(summary, m);
  const hasWinners = summary.prizes.some((prize) => prize.status === 'AWARDED');
  const times: (readonly [string, string])[] = [];
  if (summary.startedAt !== undefined) times.push([m.round.start, formatTime(summary.startedAt)]);
  if (summary.endedAt !== undefined) times.push([m.round.end, formatTime(summary.endedAt)]);
  if (summary.durationMs !== undefined)
    times.push([m.round.duration, formatDuration(summary.durationMs)]);
  return (
    <li>
      <Panel className={styles.round} aria-labelledby={headingId}>
        <div class={styles.roundHeader}>
          <h3 id={headingId} class={styles.roundTitle}>
            {m.round.title(summary.round)}
          </h3>
          <span class={`${styles.status} ${styles[`status${summary.status}`]}`}>
            {m.round.status[summary.status]}
          </span>
          {times.length > 0 && (
            <dl class={styles.times}>
              {times.map(([label, value]) => (
                <div key={label} class={styles.timeItem}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {hasWinners && (
            <Button
              onClick={() => {
                onPrint(summary.round);
              }}
            >
              {m.round.print(summary.round)}
            </Button>
          )}
        </div>
        {notes.length > 0 && (
          <ul class={styles.notes}>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        <div class={styles.tableWrap}>
          <table class={styles.table}>
            <caption class="visually-hidden">{m.table.caption(summary.round)}</caption>
            <thead>
              <tr>
                <th scope="col">{m.table.prize}</th>
                <th scope="col">{m.table.condition}</th>
                <th scope="col">{m.table.winners}</th>
                <th scope="col">{m.table.drawCount}</th>
                <th scope="col">{m.table.handout}</th>
                <th scope="col">
                  <span class="visually-hidden">{m.table.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.prizes.map((prize) => (
                <PrizeRow key={prize.slot} round={summary.round} prize={prize} actions={actions} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </li>
  );
}
