import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestHost,
  createTestPlatform,
  renderWithServices,
  type TestHost,
} from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import SettingsPage from './SettingsPage';

async function readOnlyHost(first: TestHost): Promise<TestHost> {
  return createTestHost({
    documents: first.platform.documents,
    events: first.platform.events,
    lock: {
      acquire: () => Promise.resolve('HELD_ELSEWHERE'),
      steal: () => Promise.resolve(),
      release: () => undefined,
    },
  });
}

beforeEach(() => {
  toasts.value = [];
});

describe('SettingsPage', () => {
  it('renders every section and moves focus through the section navigation', async () => {
    const test = await createTestHost();
    renderWithServices(<SettingsPage />, test);
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument();
    for (const name of ['Anlässe', 'Anlass', 'Darstellung', 'Daten', 'PIN', 'Über']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    const nav = screen.getByRole('navigation', { name: 'Abschnitte der Einstellungen' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Daten' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Daten' }));
    expect(window.location.hash).not.toContain('settings-');
  });

  it('is view-only in a window that does not control the game', async () => {
    const first = await createTestHost();
    const second = await readOnlyHost(first);
    renderWithServices(<SettingsPage />, second);
    expect(
      screen.getByText(/Nur Ansicht: Änderungen sind nur im steuernden Fenster/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neuer Anlass' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Einstellungen speichern' })).toBeDisabled();
    expect(screen.getByLabelText('Sprache')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Alle Gewinnernamen löschen' })).toBeDisabled();
  });
});

describe('Darstellung', () => {
  it('applies device preferences immediately', async () => {
    const test = await createTestHost();
    renderWithServices(<SettingsPage />, test);
    fireEvent.change(screen.getByLabelText('Dauer der Ziehung'), { target: { value: 'THRILL' } });
    fireEvent.change(screen.getByLabelText('Thema der Anzeige'), { target: { value: 'LIGHT' } });
    fireEvent.change(screen.getByLabelText('Thema der Konsole'), { target: { value: 'DARK' } });
    fireEvent.click(screen.getByRole('switch', { name: /Leistungsmodus/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Töne/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Zahlen ansagen/ }));
    expect(test.app.prefs.value).toMatchObject({
      animation: 'THRILL',
      displayTheme: 'LIGHT',
      hostTheme: 'DARK',
      performanceMode: true,
      sound: true,
      voice: true,
    });
    const digits = screen.getByRole('switch', { name: /Ziffern wiederholen/ });
    expect(digits).toBeEnabled();
    fireEvent.click(digits);
    expect(test.app.prefs.value.voiceDigits).toBe(false);
    fireEvent.change(screen.getByLabelText('Sprache'), { target: { value: 'en' } });
    expect(test.app.prefs.value.locale).toBe('en');
    await test.app.queue.flush();
    expect(await test.platform.documents.getMeta('preferences')).toMatchObject({ locale: 'en' });
  });

  it('hides voice options where the browser has no speech output', async () => {
    const test = await createTestHost({
      announcer: { supported: false, announce: vi.fn(), cancel: vi.fn() },
    });
    renderWithServices(<SettingsPage />, test);
    expect(screen.getByText('Dieser Browser bietet keine Sprachausgabe.')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Zahlen ansagen/ })).toBeNull();
  });
});

describe('Über', () => {
  it('shows build, storage and offline status and exports diagnostics without names', async () => {
    const download = vi.fn<(fileName: string, content: Blob) => void>();
    const test = await createTestHost({ screen: { ...createTestPlatform().screen, download } });
    test.host.startRound();
    test.host.spin();
    test.host.award({ winners: [{ cardNo: '3', name: 'Anna Muster' }] });
    renderWithServices(<SettingsPage />, test);
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('test-commit')).toBeInTheDocument();
    expect(await screen.findByText('1.0 KB von 1.0 MB belegt')).toBeInTheDocument();
    expect(screen.getByText('gewährt')).toBeInTheDocument();
    expect(
      screen.getByText('Nur im Arbeitsspeicher: Daten gehen beim Schliessen verloren', {
        selector: 'dd',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('vom Browser nicht unterstützt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose exportieren' }));
    expect(download).toHaveBeenCalledTimes(1);
    const [name, blob] = download.mock.calls[0] ?? [];
    expect(name).toMatch(/^lottomatch-diagnose-\d{4}-\d{2}-\d{2}\.json$/);
    const text = await blob?.text();
    expect(text).toContain('"format": "lottomatch-live-diagnostics"');
    expect(text).not.toContain('Anna');
    await waitFor(() => {
      expect(toasts.value.map((toast) => toast.message)).toContain('Diagnose exportiert');
    });
  });
});
