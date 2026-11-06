import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { auditEntries } from '../../../application/audit';
import { computeResults } from '../../../application/results';
import { EMPTY_CATALOGUE } from '../../../domain/catalogue';
import type { LogEvent } from '../../../domain/types';
import { buildLog, evening, EVENING, SETTINGS } from '../../../test/results-fixture';
import { AUDIT_PAGE_SIZE, AuditLog } from './AuditLog';
import { PrintWinnerList } from './PrintWinnerList';
import { RoundResults } from './RoundResults';

const rules = { maxNumber: 90, perLine: 5, lines: 3, boardReset: 'ROUND' } as const;

function longLog(): LogEvent[] {
  const draws: LogEvent[] = Array.from({ length: 89 }, (_, index) => ({
    type: 'NUMBER_DRAWN',
    round: 1,
    draw: { seq: index + 1, number: index + 1, method: 'RANDOM' },
  }));
  return [
    { type: 'ROUND_STARTED', round: 1, rules },
    ...draws,
    { type: 'PRIZE_SKIPPED', round: 1, slot: 1, reason: 'a' },
    { type: 'PRIZE_SKIPPED', round: 1, slot: 2, reason: 'b' },
    { type: 'PRIZE_SKIPPED', round: 1, slot: 3, reason: 'c' },
    { type: 'PRIZE_SKIPPED', round: 1, slot: 4, reason: 'd' },
    { type: 'ROUND_STARTED', round: 2, rules },
    { type: 'NUMBER_DRAWN', round: 2, draw: { seq: 1, number: 9, method: 'MANUAL' } },
    { type: 'CLAIM_REJECTED', round: 2, slot: 1, claimed: [3], missing: [3] },
    ...Array.from({ length: 12 }, (_, index): LogEvent => ({
      type: 'NUMBER_DRAWN',
      round: 2,
      draw: { seq: index + 2, number: index + 20, method: 'RANDOM' },
    })),
  ];
}

describe('AuditLog', () => {
  it('shows the newest entries first and pages through long logs', () => {
    const events = longLog();
    render(<AuditLog entries={auditEntries(buildLog(events))} verify={vi.fn()} />);
    const list = screen.getByRole('list', { name: 'Protokoll' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(AUDIT_PAGE_SIZE);
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(`Nr. ${events.length}`);
    expect(
      screen.getByText(`${AUDIT_PAGE_SIZE} von ${events.length} Einträgen`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Einträge anzeigen' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(events.length);
    expect(
      screen.queryByRole('button', { name: 'Weitere Einträge anzeigen' }),
    ).not.toBeInTheDocument();
  });

  it('filters by category and round', () => {
    render(<AuditLog entries={auditEntries(buildLog(EVENING))} verify={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Kategorie'), { target: { value: 'CORRECTIONS' } });
    const list = screen.getByRole('list', { name: 'Protokoll' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Gewinnkarte korrigiert'),
      expect.stringContaining('Gewinn widerrufen'),
      expect.stringContaining('rückgängig gemacht'),
    ]);
    fireEvent.change(screen.getByLabelText('Gang'), { target: { value: '2' } });
    expect(screen.getByText('Keine Einträge für diese Auswahl.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Kategorie'), { target: { value: 'ALL' } });
    expect(
      within(screen.getByRole('list', { name: 'Protokoll' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('reports an intact chain, a broken chain and a failed check', async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, checked: 26 })
      .mockResolvedValueOnce({ ok: false, brokenAt: 7 })
      .mockRejectedValueOnce(new Error('storage'));
    render(<AuditLog entries={auditEntries(buildLog(EVENING))} verify={verify} />);
    const button = screen.getByRole('button', { name: 'Protokoll prüfen' });
    fireEvent.click(button);
    expect(
      await screen.findByText('26 Einträge geprüft: Die Kette ist unversehrt.'),
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(
      await screen.findByText('Die Kette ist ab Eintrag 7 beschädigt oder verändert.'),
    ).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Die Prüfung ist fehlgeschlagen.');
    });
  });
});

describe('round and print views', () => {
  const { log, game } = evening();
  const results = computeResults({ game, log, catalogue: EMPTY_CATALOGUE, settings: SETTINGS });
  const first = results.rounds[0];
  if (first === undefined) throw new Error('round 1 missing');

  it('shows Stechen passes, shared prizes, late claims and round notes', () => {
    const actions = { canEdit: true, onHandout: vi.fn(), onCorrect: vi.fn() };
    render(
      <ol>
        <RoundResults summary={first} actions={actions} onPrint={vi.fn()} />
      </ol>,
    );
    expect(screen.getByText('Stechen')).toBeInTheDocument();
    expect(screen.getByText('Durchgang 2: Karte 12: 10, Karte 30: 80')).toBeInTheDocument();
    expect(screen.getByText('Karte 30 gewinnt das Stechen')).toBeInTheDocument();
    expect(screen.getByText('geteilt unter 2 Karten')).toBeInTheDocument();
    expect(screen.getByText('verspätet gemeldet')).toBeInTheDocument();
    expect(screen.getByText('gültig seit Ziehung 5 (Zahl 42)')).toBeInTheDocument();
    expect(screen.getByText('1 Fehlmeldung')).toBeInTheDocument();
    expect(screen.getByText('1 Gewinn widerrufen')).toBeInTheDocument();
    expect(screen.getByText('CHF 50.50 · gestiftet von Bäckerei Frei')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preis 4 abgeholt' }));
    expect(actions.onHandout).toHaveBeenCalledWith(1, 4, 'COLLECTED');
    fireEvent.click(screen.getByRole('button', { name: 'Präsentkorb abgeholt' }));
    expect(actions.onHandout).toHaveBeenCalledWith(1, 1, 'OPEN');
  });

  it('prints a winner list with handout boxes', () => {
    render(
      <PrintWinnerList
        rounds={results.rounds}
        settings={SETTINGS}
        printedAt="2026-11-07T21:30:00.000Z"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Gewinnerliste' })).toBeInTheDocument();
    expect(screen.getByText('Lottomatch 2026 · 07.11.2026')).toBeInTheDocument();
    expect(screen.getByText('Karte 18 · Anna Muster')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'offen' })).toHaveLength(3);
    expect(screen.getByText('Gedruckt am 07.11.2026, 22:30:00')).toBeInTheDocument();
  });

  it('prints an empty list before the first win', () => {
    const empty = computeResults({
      game: evening().game,
      log: [],
      catalogue: EMPTY_CATALOGUE,
      settings: SETTINGS,
    });
    render(
      <PrintWinnerList
        rounds={empty.rounds.slice(2)}
        settings={{ ...SETTINGS, date: '' }}
        printedAt="2026-11-07T21:30:00.000Z"
      />,
    );
    expect(screen.getByText('Noch keine Gewinne.')).toBeInTheDocument();
    expect(screen.getByText('Lottomatch 2026')).toBeInTheDocument();
  });
});
