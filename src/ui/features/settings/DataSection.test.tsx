import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExport } from '../../../application/backup-export';
import {
  createTestHost,
  createTestPlatform,
  renderWithServices,
  type TestHost,
} from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { DataSection } from './DataSection';

function messages(): string[] {
  return toasts.value.map((toast) => toast.message);
}

function play(test: TestHost, name: string): void {
  expect(test.host.startRound().ok).toBe(true);
  expect(test.host.spin().ok).toBe(true);
  expect(test.host.award({ winners: [{ cardNo: '21', name }] }).ok).toBe(true);
}

async function exportText(): Promise<string> {
  const source = await createTestHost();
  play(source, 'Anna');
  const session = source.app.session.value;
  if (session === undefined) throw new Error('no session');
  return JSON.stringify(await buildExport(source.app, session));
}

function fileInput(): HTMLInputElement {
  const input = screen.getByLabelText('Datei wählen');
  if (!(input instanceof HTMLInputElement)) throw new Error('file input missing');
  return input;
}

beforeEach(() => {
  toasts.value = [];
});

describe('Daten', () => {
  it('exports a backup and shows the backup time', async () => {
    const download = vi.fn<(fileName: string, content: Blob) => void>();
    const test = await createTestHost({ screen: { ...createTestPlatform().screen, download } });
    renderWithServices(<DataSection canEdit />, test);
    expect(screen.getByText('Noch keine Sicherung exportiert.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sicherung exportieren' }));
    expect(await screen.findByText(/^Letzte Sicherung: /)).toBeInTheDocument();
    expect(download).toHaveBeenCalledTimes(1);
    expect(messages()).toContain('Sicherung exportiert');
  });

  it('reports an export failure', async () => {
    const download = vi.fn<(fileName: string, content: Blob) => void>(() => {
      throw new Error('blocked');
    });
    const test = await createTestHost({ screen: { ...createTestPlatform().screen, download } });
    renderWithServices(<DataSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Sicherung exportieren' }));
    await waitFor(() => {
      expect(messages()).toContain('Unerwarteter Fehler. Details unter Einstellungen → Über.');
    });
    expect(vi.mocked(test.platform.reportError)).toHaveBeenCalled();
  });

  it('deletes all winner names after confirmation', async () => {
    const test = await createTestHost();
    play(test, 'Anna Muster');
    renderWithServices(<DataSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Alle Gewinnernamen löschen' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/lässt sich nicht rückgängig machen/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Namen löschen' }));
    await waitFor(() => {
      expect(messages()).toContain('1 Gewinnereintrag bereinigt');
    });
    const winners = test.app.session.value?.game.value.rounds.get(1)?.prizes[1].award?.winners;
    expect(winners).toEqual([{ cardNo: '21' }]);
  });

  it('resets the event only after the confirmation word is typed', async () => {
    const test = await createTestHost();
    play(test, 'Anna');
    renderWithServices(<DataSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Anlass zurücksetzen' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Zurücksetzen' });
    expect(confirm).toBeDisabled();
    fireEvent.input(within(dialog).getByLabelText('Zum Bestätigen «ZURÜCKSETZEN» eintippen'), {
      target: { value: 'ZURÜCKSETZEN' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(test.app.session.value?.game.value.phase).toBe('READY');
    });
    expect(messages()).toContain('Anlass zurückgesetzt');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('imports a backup as a new event after the preview', async () => {
    const test = await createTestHost();
    const user = userEvent.setup();
    renderWithServices(<DataSection canEdit />, test);
    const file = new File([await exportText()], 'sicherung.json', { type: 'application/json' });
    await user.upload(fileInput(), file);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Import prüfen')).toBeInTheDocument();
    expect(within(dialog).getByText('geprüft und korrekt')).toBeInTheDocument();
    expect(within(dialog).getByText('Lottomatch')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Als neuen Anlass importieren' }));
    await waitFor(() => {
      expect(messages()).toContain('«Lottomatch» importiert und aktiv');
    });
    expect(test.app.matches.value).toHaveLength(2);
    expect(test.app.session.value?.game.value.rounds.get(1)?.prizes[1].status).toBe('AWARDED');
  });

  it('explains why a file cannot be imported', async () => {
    const test = await createTestHost();
    const user = userEvent.setup();
    renderWithServices(<DataSection canEdit />, test);
    await user.upload(fileInput(), new File(['kein json'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Datei ist kein gültiges JSON.');
    const tooNew = JSON.stringify({ format: 'lottomatch-live', schemaVersion: 9 });
    await user.upload(fileInput(), new File([tooNew], 'neu.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Datei stammt aus einer neueren Version (Schema 9). Bitte die App aktualisieren.',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disables destructive actions without control of the game', async () => {
    const test = await createTestHost();
    renderWithServices(<DataSection canEdit={false} />, test);
    expect(screen.getByRole('button', { name: 'Alle Gewinnernamen löschen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anlass zurücksetzen' })).toBeDisabled();
    expect(fileInput()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sicherung exportieren' })).toBeEnabled();
  });
});
