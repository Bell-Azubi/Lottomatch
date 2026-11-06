import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExport } from '../../../application/backup-export';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { AboutSection } from './AboutSection';
import { DataSection } from './DataSection';
import { EventForm } from './EventForm';
import { EventsSection } from './EventsSection';

/** A second window on the same stores that does not control the game. */
async function readOnlyHost(first: TestHost): Promise<TestHost> {
  return createTestHost({
    documents: first.platform.documents,
    events: first.platform.events,
    images: first.platform.images,
    lock: {
      acquire: () => Promise.resolve('HELD_ELSEWHERE'),
      steal: () => Promise.resolve(),
      release: () => undefined,
    },
  });
}

function messages(): string[] {
  return toasts.value.map((toast) => toast.message);
}

beforeEach(() => {
  toasts.value = [];
});

describe('settings when the window lost control', () => {
  it('reports refused event administration', async () => {
    const second = await readOnlyHost(await createTestHost());
    renderWithServices(<EventsSection canEdit />, second);
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Anlass' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() => {
      expect(messages()).toContain('Nur im steuernden Fenster möglich.');
    });
  });

  it('reports refused settings, erasing, resetting and importing', async () => {
    const first = await createTestHost();
    const session = first.app.session.value;
    if (session === undefined) throw new Error('no session');
    const backup = JSON.stringify(await buildExport(first.app, session));
    const second = await readOnlyHost(first);
    renderWithServices(
      <>
        <EventForm canEdit />
        <DataSection canEdit />
      </>,
      second,
    );
    fireEvent.input(screen.getByLabelText('Ort (optional)'), { target: { value: 'Halle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));
    expect(messages()).toContain('Nur Ansicht: Änderungen sind nur im steuernden Fenster möglich.');
    fireEvent.click(screen.getByRole('button', { name: 'Alle Gewinnernamen löschen' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Namen löschen' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Anlass zurücksetzen' }));
    const reset = screen.getByRole('dialog');
    fireEvent.input(within(reset).getByLabelText(/ZURÜCKSETZEN/), {
      target: { value: 'ZURÜCKSETZEN' },
    });
    fireEvent.click(within(reset).getByRole('button', { name: 'Zurücksetzen' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(messages().filter((m) => m === 'Nur im steuernden Fenster möglich.')).toHaveLength(2);
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText('Datei wählen'),
      new File([backup], 'b.json', { type: 'application/json' }),
    );
    const preview = await screen.findByRole('dialog');
    fireEvent.click(within(preview).getByRole('button', { name: 'Als neuen Anlass importieren' }));
    await waitFor(() => {
      expect(messages()).toContain('Der Import konnte nicht abgeschlossen werden.');
    });
    expect(second.app.matches.value).toHaveLength(1);
    await user.upload(
      screen.getByLabelText('Datei wählen'),
      new File([backup], 'b.json', { type: 'application/json' }),
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('import failures', () => {
  it('reports a file that cannot be read and a failed commit', async () => {
    const test = await createTestHost();
    const session = test.app.session.value;
    if (session === undefined) throw new Error('no session');
    const backup = JSON.stringify(await buildExport(test.app, session));
    renderWithServices(<DataSection canEdit />, test);
    const user = userEvent.setup();
    const broken = new File(['x'], 'x.json', { type: 'application/json' });
    vi.spyOn(broken, 'text').mockRejectedValue(new Error('read failed'));
    await user.upload(screen.getByLabelText('Datei wählen'), broken);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Der Import konnte nicht abgeschlossen werden.',
    );
    expect(vi.mocked(test.platform.reportError)).toHaveBeenCalledWith(
      expect.any(Error),
      'settings:import',
    );
    await user.upload(
      screen.getByLabelText('Datei wählen'),
      new File([backup], 'b.json', { type: 'application/json' }),
    );
    const preview = await screen.findByRole('dialog');
    vi.spyOn(test.admin, 'switchTo').mockResolvedValue({ ok: false, error: 'LOAD_FAILED' });
    fireEvent.click(within(preview).getByRole('button', { name: 'Als neuen Anlass importieren' }));
    await waitFor(() => {
      expect(messages()).toContain('Der Import konnte nicht abgeschlossen werden.');
    });
  });
});

describe('Über: service-worker and storage states', () => {
  it('describes every offline state and an unknown storage usage', async () => {
    const test = await createTestHost({
      storage: {
        persist: () => Promise.resolve('BEST_EFFORT'),
        estimate: () => Promise.resolve(undefined),
      },
    });
    renderWithServices(<AboutSection />, test);
    expect(screen.getByText('vom Browser nicht unterstützt')).toBeInTheDocument();
    test.pwa.connect(true, () => Promise.resolve());
    expect(await screen.findByText('wird vorbereitet')).toBeInTheDocument();
    test.pwa.markOfflineReady();
    expect(await screen.findByText('bereit')).toBeInTheDocument();
    test.pwa.markUpdateReady();
    expect(
      await screen.findByText('Update bereit (wird zwischen den Gängen angeboten)'),
    ).toBeInTheDocument();
    test.pwa.markFailed();
    expect(await screen.findByText('Registrierung fehlgeschlagen')).toBeInTheDocument();
    expect(screen.getByText('Belegung unbekannt')).toBeInTheDocument();
    expect(
      screen.getByText('nicht gewährt: Der Browser darf die Daten bei Speichermangel löschen'),
    ).toBeInTheDocument();
  });
});
