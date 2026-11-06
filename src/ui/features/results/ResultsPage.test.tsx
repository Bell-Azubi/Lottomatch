import { fireEvent, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Platform } from '../../../application/platform';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import ResultsPage from './ResultsPage';

const hosts: TestHost[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.hostLink.dispose();
});

async function playedHost(overrides: Partial<Platform> = {}): Promise<TestHost> {
  const services = await createTestHost(overrides);
  hosts.push(services);
  const { host } = services;
  expect(host.startRound().ok).toBe(true);
  for (const number of [5, 12, 23, 34, 42]) expect(host.drawManual(number).ok).toBe(true);
  expect(host.award({ winners: [{ cardNo: '17', name: 'Anna Muster' }] }).ok).toBe(true);
  expect(host.skipPrize('Kein Preis vorhanden').ok).toBe(true);
  return services;
}

function rounds(): HTMLElement {
  return screen.getByRole('region', { name: 'Runden' });
}

function asBlob(content: unknown): Blob {
  if (!(content instanceof Blob)) throw new Error('download content is not a Blob');
  return content;
}

async function blobText(content: unknown): Promise<string> {
  return asBlob(content).text();
}

describe('ResultsPage', () => {
  it('shows totals, the round and its winners', async () => {
    const services = await playedHost();
    renderWithServices(<ResultsPage />, services);
    expect(screen.getByRole('heading', { level: 1, name: 'Auswertung' })).toBeInTheDocument();
    const totals = screen.getByRole('region', { name: 'Übersicht' });
    expect(within(totals).getByText('Preise vergeben').nextElementSibling).toHaveTextContent('1');
    expect(within(totals).getByText('Gezogene Zahlen').nextElementSibling).toHaveTextContent('5');
    const list = rounds();
    expect(within(list).getByRole('heading', { name: 'Runde 1' })).toBeInTheDocument();
    expect(within(list).getByText('läuft')).toBeInTheDocument();
    expect(within(list).getByText('Karte 17')).toBeInTheDocument();
    expect(within(list).getByText(/Anna Muster/)).toBeInTheDocument();
    expect(within(list).getByText('nach 5 Zahlen')).toBeInTheDocument();
    expect(within(list).getByText('übersprungen: Kein Preis vorhanden')).toBeInTheDocument();
    expect(within(list).getAllByText('noch offen')).toHaveLength(2);
  });

  it('toggles the handout status and filters open handouts', async () => {
    const services = await playedHost();
    renderWithServices(<ResultsPage />, services);
    const button = within(rounds()).getByRole('button', { name: 'Preis 1 abgeholt' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(within(rounds()).getByRole('button', { name: 'Preis 1 abgeholt' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(services.app.session.value?.game.value.rounds.get(1)?.prizes[1].award?.handout).toBe(
      'COLLECTED',
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Nur nicht abgeholte Preise' }));
    expect(screen.getByText('Alle vergebenen Preise sind abgeholt.')).toBeInTheDocument();
  });

  it('corrects the winning card without revoking the award', async () => {
    const services = await playedHost();
    renderWithServices(<ResultsPage />, services);
    fireEvent.click(within(rounds()).getByRole('button', { name: 'Preis 1 korrigieren' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Gewinnkarte korrigieren: Runde 1, Preis 1',
    });
    fireEvent.input(within(dialog).getByLabelText('Kartennummer'), { target: { value: ' 18 ' } });
    fireEvent.input(within(dialog).getByLabelText('Name (optional)'), {
      target: { value: 'Anna Beispiel' },
    });
    fireEvent.input(within(dialog).getByLabelText('Notiz (optional)'), {
      target: { value: 'Tisch 4' },
    });
    fireEvent.input(within(dialog).getByLabelText('Grund (optional, wird protokolliert)'), {
      target: { value: 'Tippfehler' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(rounds()).getByText('Karte 18')).toBeInTheDocument();
    expect(within(rounds()).getByText('1-mal korrigiert')).toBeInTheDocument();
    const award = services.app.session.value?.game.value.rounds.get(1)?.prizes[1].award;
    expect(award?.winners).toEqual([{ cardNo: '18', name: 'Anna Beispiel', note: 'Tisch 4' }]);
  });

  it('keeps the correction dialog open with the error when the correction fails', async () => {
    const services = await playedHost();
    renderWithServices(<ResultsPage />, services);
    fireEvent.click(within(rounds()).getByRole('button', { name: 'Preis 1 korrigieren' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.input(within(dialog).getByLabelText('Kartennummer'), {
      target: { value: 'x'.repeat(21) },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(
      within(screen.getByRole('dialog')).getByText('Die Angaben zur Gewinnkarte sind ungültig.'),
    ).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exports the winners as CSV and the results as JSON', async () => {
    const services = await playedHost();
    const download = vi.spyOn(services.platform.screen, 'download');
    renderWithServices(<ResultsPage />, services);
    fireEvent.click(screen.getByRole('button', { name: 'Gewinner als CSV' }));
    const [csvName, csvBlob] = download.mock.calls[0] ?? [];
    expect(csvName).toMatch(/^lottomatch-gewinner-lottomatch-2026-11-07\.csv$/);
    const bytes = new Uint8Array(await asBlob(csvBlob).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = await blobText(csvBlob);
    expect(csv.startsWith('Runde;Preis;Titel;Gewinnregel;Wert CHF')).toBe(true);
    expect(csv).toContain('1;Preis 1;;1 Reihe;;;17;Anna Muster;;5;');
    expect(csv.endsWith('\r\n')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Auswertung als JSON' }));
    const [jsonName, jsonBlob] = download.mock.calls[1] ?? [];
    expect(jsonName).toMatch(/^lottomatch-auswertung-lottomatch-2026-11-07\.json$/);
    const document = JSON.parse(await blobText(jsonBlob)) as {
      format: string;
      totals: { winners: number };
    };
    expect(document.format).toBe('lottomatch-live-results');
    expect(document.totals.winners).toBe(1);
  });

  it('prints the complete winner list or one round', async () => {
    const services = await playedHost();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderWithServices(<ResultsPage />, services);
    fireEvent.click(screen.getByRole('button', { name: 'Gewinnerliste drucken' }));
    expect(print).toHaveBeenCalledTimes(1);
    fireEvent.click(within(rounds()).getByRole('button', { name: 'Runde 1 drucken' }));
    expect(print).toHaveBeenCalledTimes(2);
    fireEvent(window, new Event('beforeprint'));
    fireEvent(window, new Event('afterprint'));
    expect(screen.getByRole('heading', { name: 'Gewinnerliste' })).toBeInTheDocument();
  });

  it('shows every round on request', async () => {
    const services = await playedHost();
    renderWithServices(<ResultsPage />, services);
    expect(within(rounds()).queryByRole('heading', { name: 'Runde 24' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Anzeigen'), { target: { value: 'ALL' } });
    expect(within(rounds()).getByRole('heading', { name: 'Runde 24' })).toBeInTheDocument();
    expect(within(rounds()).getAllByText('ausstehend').length).toBeGreaterThan(20);
  });

  it('disables changes in a read-only window', async () => {
    let lose: () => void = () => undefined;
    const services = await playedHost({
      lock: {
        acquire: (onLost) => {
          lose = onLost;
          return Promise.resolve('ACQUIRED');
        },
        steal: () => Promise.resolve(),
        release: () => undefined,
      },
    });
    lose();
    renderWithServices(<ResultsPage />, services);
    expect(within(rounds()).getByRole('button', { name: 'Preis 1 abgeholt' })).toBeDisabled();
    expect(within(rounds()).getByRole('button', { name: 'Preis 1 korrigieren' })).toBeDisabled();
  });

  it('verifies the stored hash chain', async () => {
    const services = await playedHost();
    renderWithServices(<ResultsPage />, services);
    fireEvent.click(screen.getByRole('button', { name: 'Protokoll prüfen' }));
    const total = services.app.session.value?.log.length ?? 0;
    expect(
      await screen.findByText(`${total} Einträge geprüft: Die Kette ist unversehrt.`),
    ).toBeInTheDocument();
  });

  it('explains when no event is open', async () => {
    const services = await createTestHost({
      lock: {
        acquire: () => Promise.resolve('HELD_ELSEWHERE'),
        steal: () => Promise.resolve(),
        release: () => undefined,
      },
    });
    hosts.push(services);
    renderWithServices(<ResultsPage />, services);
    expect(screen.getByText('Kein Anlass geöffnet.')).toBeInTheDocument();
  });
});
