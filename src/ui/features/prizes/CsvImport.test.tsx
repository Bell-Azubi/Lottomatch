import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrizeEditor } from '../../../application/prize-editor';
import { prizeAt } from '../../../domain/catalogue';
import { prizes as m } from '../../../i18n/de-CH/prizes';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { CsvImport } from './CsvImport';

const CSV = [
  '\uFEFFRunde;Preis;Titel;Beschreibung;Wert CHF;Sponsor;Gewinnregel',
  '1;1;Zopf und Konfitüre;;25.–;Bäckerei Muster;1 Reihe',
  '1;Hauptpreis;Velo;Für Gross und Klein;1’000.50;;Volle Karte',
  '2;9;Falsch;;;;',
  '30;1;Zu weit;;;;',
].join('\r\n');

function openWith(host: TestHost, content: string): void {
  renderWithServices(<CsvImport editor={new PrizeEditor(host.app)} readOnly={false} />, host);
  fireEvent.click(screen.getByRole('button', { name: m.csv.import }));
  const file = new File([content], 'preise.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText(m.csv.file), { target: { files: [file] } });
}

beforeEach(() => {
  toasts.value = [];
});

describe('CsvImport', () => {
  it('previews valid rows and row errors before committing', async () => {
    const host = await createTestHost();
    openWith(host, CSV);
    expect(await screen.findByText(m.csv.summary(2, 4))).toBeInTheDocument();
    expect(screen.getByText(m.csv.row(4, m.csv.rowErrors.SLOT_INVALID))).toBeInTheDocument();
    expect(screen.getByText(m.csv.row(5, m.csv.rowErrors.ROUND_OUT_OF_RANGE))).toBeInTheDocument();
    expect(screen.getByText('Zopf und Konfitüre')).toBeInTheDocument();
    const session = host.app.session.value;
    expect(session?.catalogue.value.prizes).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: m.csv.commit(2) }));
    expect(session && prizeAt(session.catalogue.value, 1, 4)).toMatchObject({
      title: 'Velo',
      valueChf: 1000.5,
    });
    expect(session && prizeAt(session.catalogue.value, 1, 1)?.sponsor).toBe('Bäckerei Muster');
    expect(toasts.value.at(-1)?.message).toBe(m.csv.imported(2));
  });

  it('reports empty files and missing columns', async () => {
    const host = await createTestHost();
    openWith(host, 'Runde;Preis;Titel\r\n');
    expect(await screen.findByRole('alert')).toHaveTextContent(m.csv.empty);
    fireEvent.change(screen.getByLabelText(m.csv.file), {
      target: { files: [new File(['Titel;Wert\nA;5\n'], 'a.csv')] },
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(m.csv.missingColumns('Runde, Preis'));
    });
  });

  it('reports unreadable files', async () => {
    const host = await createTestHost({
      csv: { parse: () => Promise.reject(new Error('broken')), serialize: () => '' },
    });
    openWith(host, 'x');
    expect(await screen.findByRole('alert')).toHaveTextContent(m.csv.unreadable);
    expect(host.platform.reportError).toHaveBeenCalled();
  });

  it('keeps the commit button disabled until a preview exists and can be cancelled', async () => {
    const host = await createTestHost();
    renderWithServices(<CsvImport editor={new PrizeEditor(host.app)} readOnly={false} />, host);
    fireEvent.click(screen.getByRole('button', { name: m.csv.import }));
    expect(screen.getByRole('button', { name: m.csv.commit(0) })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
