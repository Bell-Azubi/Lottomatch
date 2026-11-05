import { zurichDate, type AppStore } from '../../../application/app-store';
import { slugify } from '../../../application/backup-format';
import type { MatchRecord } from '../../../application/records';
import type { EventResults } from '../../../application/results';
import { resultsDocument, winnerRows, type WinnerRow } from '../../../application/results-output';
import { chfToPlain } from '../../../domain/money';
import type { CommonMessages } from '../../../i18n/de-CH/common';
import type { ResultsMessages } from '../../../i18n/de-CH/results';
import { formatDateTime } from '../../../i18n/format';
import { conditionLabel } from '../../../i18n/labels';

/** Header and cells of the winner CSV in the UI language. */
export function winnerTable(
  rows: readonly WinnerRow[],
  m: ResultsMessages,
  c: CommonMessages,
): { headers: string[]; cells: string[][] } {
  const h = m.csv;
  const flag = (value: boolean) => (value ? h.yes : h.no);
  return {
    headers: [
      h.round,
      h.slot,
      h.title,
      h.condition,
      h.value,
      h.sponsor,
      h.cardNo,
      h.name,
      h.note,
      h.drawCount,
      h.awardedAt,
      h.handout,
      h.shared,
      h.tiebreak,
      h.late,
    ],
    cells: rows.map((row) => [
      String(row.round),
      c.prizeSlot(row.slot),
      row.title ?? '',
      conditionLabel(row.condition, c),
      row.valueChf === undefined ? '' : chfToPlain(row.valueChf),
      row.sponsor ?? '',
      row.cardNo ?? '',
      row.name ?? '',
      row.note ?? '',
      row.drawCount === undefined ? '' : String(row.drawCount),
      row.awardedAt === undefined ? '' : formatDateTime(row.awardedAt),
      row.handout === undefined ? '' : m.handout[row.handout],
      flag(row.shared),
      flag(row.tiebreak),
      flag(row.late),
    ]),
  };
}

function fileStem(kind: string, match: MatchRecord, iso: string): string {
  return `lottomatch-${kind}-${slugify(match.settings.name)}-${zurichDate(iso)}`;
}

/** Downloads the winners as CSV for Excel de-CH (UTF-8 BOM, `;`, CRLF). */
export function downloadWinnersCsv(
  app: AppStore,
  match: MatchRecord,
  results: EventResults,
  m: ResultsMessages,
  c: CommonMessages,
): void {
  const { headers, cells } = winnerTable(winnerRows(results.rounds), m, c);
  const { csv, screen, binary, clock } = app.platform;
  const text = csv.serialize(headers, cells);
  screen.download(
    `${fileStem('gewinner', match, clock.nowIso())}.csv`,
    binary.textToBlob(text, 'text/csv;charset=utf-8'),
  );
}

/** Downloads the structured results as JSON. */
export function downloadResultsJson(
  app: AppStore,
  match: MatchRecord,
  results: EventResults,
): void {
  const { screen, binary, clock } = app.platform;
  const exportedAt = clock.nowIso();
  const document = resultsDocument(results, match.settings, match.kind, exportedAt);
  screen.download(
    `${fileStem('auswertung', match, exportedAt)}.json`,
    binary.textToBlob(JSON.stringify(document, null, 2), 'application/json'),
  );
}
