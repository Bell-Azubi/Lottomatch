import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { EventsSection } from './EventsSection';

function activeName(test: TestHost): string | undefined {
  return test.app.session.value?.match.value.settings.name;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function messages(): string[] {
  return toasts.value.map((toast) => toast.message);
}

beforeEach(() => {
  toasts.value = [];
});

describe('Anlässe', () => {
  it('lists events with date and active badge', async () => {
    const test = await createTestHost();
    renderWithServices(<EventsSection canEdit />, test);
    const list = screen.getByRole('list', { name: 'Alle Anlässe' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Lottomatch')).toBeInTheDocument();
    expect(within(list).getByText('aktiv')).toBeInTheDocument();
    expect(within(list).getByText(/^\d{2}\.\d{2}\.\d{4}$/)).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: 'Wechseln' })).toBeNull();
  });

  it('creates a new event and makes it active', async () => {
    const test = await createTestHost();
    renderWithServices(<EventsSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Anlass' }));
    const name = within(dialog()).getByLabelText('Name des Anlasses');
    expect(name).toHaveValue('Lottomatch');
    fireEvent.input(name, { target: { value: 'Frühlingslotto' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(activeName(test)).toBe('Frühlingslotto');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(messages()).toContain('«Frühlingslotto» erstellt');
  });

  it('asks for a valid name', async () => {
    const test = await createTestHost();
    renderWithServices(<EventsSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Anlass' }));
    fireEvent.input(within(dialog()).getByLabelText('Name des Anlasses'), {
      target: { value: '  ' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Bestätigen' }));
    expect(
      await within(dialog()).findByText('Bitte einen Namen eingeben (höchstens 80 Zeichen).'),
    ).toBeInTheDocument();
    expect(test.app.matches.value).toHaveLength(1);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('duplicates an event as a template without switching', async () => {
    const test = await createTestHost();
    renderWithServices(<EventsSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Als Vorlage kopieren' }));
    expect(within(dialog()).getByText(/keine Ziehungen und keine Gewinner/)).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('Name des Anlasses')).toHaveValue('Lottomatch (Kopie)');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() => {
      expect(test.app.matches.value).toHaveLength(2);
    });
    expect(activeName(test)).toBe('Lottomatch');
    expect(screen.getByText('Lottomatch (Kopie)')).toBeInTheDocument();
    expect(screen.getByText('ohne Datum')).toBeInTheDocument();
  });

  it('starts a badged practice event', async () => {
    const test = await createTestHost();
    renderWithServices(<EventsSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Übung starten' }));
    expect(within(dialog()).getByLabelText('Name des Anlasses')).toHaveValue('Übung – Lottomatch');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Übung starten' }));
    await waitFor(() => {
      expect(test.app.session.value?.match.value.kind).toBe('PRACTICE');
    });
    expect(screen.getByText('Übung', { selector: 'span' })).toBeInTheDocument();
  });

  it('confirms before switching away from a running round', async () => {
    const test = await createTestHost();
    await test.admin.create('Zweiter Anlass');
    expect(test.host.startRound().ok).toBe(true);
    renderWithServices(<EventsSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Wechseln' }));
    expect(within(dialog()).getByText(/Der laufende Gang bleibt gespeichert/)).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Trotzdem wechseln' }));
    await waitFor(() => {
      expect(activeName(test)).toBe('Lottomatch');
    });
    expect(messages()).toContain('«Lottomatch» ist jetzt aktiv');
  });

  it('switches directly between rounds and archives inactive events', async () => {
    const test = await createTestHost();
    await test.admin.create('Zweiter Anlass');
    renderWithServices(<EventsSection canEdit />, test);
    fireEvent.click(screen.getByRole('button', { name: 'Archivieren' }));
    expect(await screen.findByText('archiviert')).toBeInTheDocument();
    expect(messages()).toContain('«Lottomatch» archiviert');
    fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' }));
    await waitFor(() => {
      expect(screen.queryByText('archiviert')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Wechseln' }));
    await waitFor(() => {
      expect(activeName(test)).toBe('Lottomatch');
    });
  });

  it('reports failures from the event administration', async () => {
    const test = await createTestHost();
    await test.admin.create('Zweiter Anlass');
    renderWithServices(<EventsSection canEdit />, test);
    const archive = screen.getByRole('button', { name: 'Archivieren' });
    test.app.matches.value = test.app.matches.value.filter(
      (match) => match.settings.name !== 'Lottomatch',
    );
    fireEvent.click(archive);
    await waitFor(() => {
      expect(messages()).toContain('Dieser Anlass ist nicht mehr vorhanden.');
    });
  });
});
