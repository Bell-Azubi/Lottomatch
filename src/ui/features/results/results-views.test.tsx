import { render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auditEntries } from '../../../application/audit';
import { computeResults, type RoundSummary } from '../../../application/results';
import { winnerRows } from '../../../application/results-output';
import { EMPTY_CATALOGUE } from '../../../domain/catalogue';
import { common as deCommon } from '../../../i18n/de-CH/common';
import { results as deResults } from '../../../i18n/de-CH/results';
import { formatDateTime } from '../../../i18n/format';
import { locale } from '../../../i18n';
import { buildLog, evening, EVENING, SETTINGS } from '../../../test/results-fixture';
import { AuditLog } from './AuditLog';
import { winnerTable } from './exports';
import { PrintWinnerList } from './PrintWinnerList';
import { RoundResults } from './RoundResults';
import { TotalsPanel } from './TotalsPanel';

const { log, game } = evening();
const results = computeResults({ game, log, catalogue: EMPTY_CATALOGUE, settings: SETTINGS });
const actions = { canEdit: true, onHandout: vi.fn(), onCorrect: vi.fn() };

function roundAt(index: number): RoundSummary {
  const summary = results.rounds[index];
  if (summary === undefined) throw new Error(`round ${index + 1} missing`);
  return summary;
}

afterEach(() => {
  locale.value = 'de-CH';
});

describe('winnerTable', () => {
  it('formats every column for Excel de-CH', () => {
    const { headers, cells } = winnerTable(winnerRows(results.rounds), deResults, deCommon);
    expect(headers).toHaveLength(15);
    expect(headers[0]).toBe('Runde');
    expect(cells[0]).toEqual([
      '1',
      'Preis 1',
      'Präsentkorb',
      '1 Reihe',
      '50.50',
      'Bäckerei Frei',
      '18',
      'Anna Muster',
      '',
      '6',
      formatDateTime('2026-11-07T17:08:00.000Z'),
      'abgeholt',
      'nein',
      'nein',
      'ja',
    ]);
    expect(cells[2]?.slice(12)).toEqual(['ja', 'nein', 'nein']);
  });
});

describe('round notes and anonymous Stechen', () => {
  it('lists the abort reason and repeated starts', () => {
    render(
      <ol>
        <RoundResults summary={{ ...roundAt(1), runs: 2 }} actions={actions} onPrint={vi.fn()} />
      </ol>,
    );
    expect(screen.getByText('Abgebrochen: Stromausfall')).toBeInTheDocument();
    expect(screen.getByText('2-mal gestartet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /drucken/ })).not.toBeInTheDocument();
  });

  it('labels claimants without card numbers', () => {
    const first = roundAt(0);
    const stechen = first.prizes[2];
    if (stechen?.tiebreak === undefined) throw new Error('fixture has no Stechen');
    const anonymous: RoundSummary = {
      ...first,
      prizes: [
        {
          ...stechen,
          winners: [
            {
              ...stechen.winners[0],
              cardNo: undefined,
              name: undefined,
              note: 'Tisch 2',
              late: false,
              validSinceSeq: undefined,
              validSinceNumber: undefined,
            },
          ],
          tiebreak: { ...stechen.tiebreak, claimants: [{}, {}], winner: undefined },
        },
      ],
    };
    render(
      <ol>
        <RoundResults summary={anonymous} actions={actions} onPrint={vi.fn()} />
      </ol>,
    );
    expect(screen.getByText('Durchgang 1: Meldung 1: 40, Meldung 2: 40')).toBeInTheDocument();
    expect(screen.getByText('ohne Kartennummer')).toBeInTheDocument();
    expect(screen.getByText(/Tisch 2/)).toBeInTheDocument();
    expect(screen.queryByText(/gewinnt das Stechen/)).not.toBeInTheDocument();
  });
});

describe('TotalsPanel', () => {
  it('lists false claims only for events from before ADR-0025 that hold them', () => {
    const { unmount } = render(<TotalsPanel totals={results.totals} />);
    expect(screen.getByText('Fehlmeldungen')).toBeInTheDocument();
    unmount();
    render(<TotalsPanel totals={{ ...results.totals, falseClaims: 0 }} />);
    expect(screen.queryByText('Fehlmeldungen')).not.toBeInTheDocument();
  });
});

describe('English', () => {
  it('renders totals, rounds, the print list and the audit log in English', () => {
    locale.value = 'en';
    render(
      <>
        <TotalsPanel totals={results.totals} />
        <ol>
          <RoundResults summary={roundAt(0)} actions={actions} onPrint={vi.fn()} />
          <RoundResults summary={{ ...roundAt(1), runs: 3 }} actions={actions} onPrint={vi.fn()} />
        </ol>
        <PrintWinnerList
          rounds={results.rounds}
          settings={SETTINGS}
          printedAt="2026-11-07T21:30:00.000Z"
        />
        <AuditLog entries={auditEntries(buildLog(EVENING))} verify={vi.fn()} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Rounds played')).toBeInTheDocument();
    expect(screen.getByText('1 of 24')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Round 1' })).toHaveLength(2);
    expect(screen.getAllByText('played').length).toBeGreaterThan(0);
    expect(screen.getAllByText('after 6 numbers')).toHaveLength(3);
    expect(screen.getByText('claimed late')).toBeInTheDocument();
    expect(screen.getByText('valid since draw 5 (number 42)')).toBeInTheDocument();
    expect(screen.getByText('shared by 2 cards')).toBeInTheDocument();
    expect(screen.getByText('corrected once')).toBeInTheDocument();
    expect(screen.getByText('skipped: Kein Preis vorhanden')).toBeInTheDocument();
    expect(screen.getByText('Card 30 wins the tie-break')).toBeInTheDocument();
    expect(screen.getByText('1 false claim')).toBeInTheDocument();
    expect(screen.getByText('1 win revoked')).toBeInTheDocument();
    expect(screen.getByText('Aborted: Stromausfall')).toBeInTheDocument();
    expect(screen.getByText('started 3 times')).toBeInTheDocument();
    expect(screen.getAllByText('still open').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Winner list' })).toBeInTheDocument();
    expect(screen.getByText('Printed on 07.11.2026, 22:30:00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getByText(`${EVENING.length} of ${EVENING.length} entries`)).toBeInTheDocument();
    expect(screen.getByText('Round 1 started (numbers 1–90)')).toBeInTheDocument();
    const { headers } = winnerTable(winnerRows(results.rounds), deResults, deCommon);
    expect(headers).toContain('Wert CHF');
  });
});
