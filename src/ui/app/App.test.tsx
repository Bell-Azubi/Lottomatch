import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { present } from '../../test/assert';
import { createTestHost, renderWithServices, type TestHost } from '../../test/test-platform';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { LazyRoute } from './LazyRoute';
import { PinGate } from './PinGate';
import { RecoveryScreen } from './RecoveryScreen';
import { currentRoute, href, navigate, parseRoute, startRouter } from './router';
import { SystemBanners } from './SystemBanners';
import { applyTheme } from './theme';

let t: TestHost | undefined;

afterEach(() => {
  t?.hostLink.dispose();
  t = undefined;
  currentRoute.value = 'start';
});

describe('router', () => {
  it('parses hash routes and falls back to Start', () => {
    expect(parseRoute('')).toBe('start');
    expect(parseRoute('#/')).toBe('start');
    expect(parseRoute('#/host')).toBe('host');
    expect(parseRoute('#/settings?x=1')).toBe('settings');
    expect(parseRoute('#/unknown')).toBe('start');
    expect(href('start')).toBe('#/');
    expect(href('results')).toBe('#/results');
    const stop = startRouter();
    navigate('prizes');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(currentRoute.value).toBe('prizes');
    stop();
  });

  it('applies themes to the document', () => {
    applyTheme('LIGHT');
    expect(document.documentElement.dataset['theme']).toBe('light');
    applyTheme('SYSTEM');
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });
});

describe('App shell', () => {
  it('shows the start page with header, navigation and readiness', async () => {
    t = await createTestHost();
    render(<App services={t} />);
    expect(await screen.findByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('img', { name: 'FC Laufenburg-Kaisten' })).toBeInTheDocument();
    expect(screen.getByText('Bereit für den Anlass?')).toBeInTheDocument();
    expect(screen.getByText('96 Preise fehlen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ton aus' }));
    expect(t.app.prefs.value.muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Gang starten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trotzdem starten' }));
    await waitFor(() => {
      expect(window.location.hash).toBe('#/host');
    });
  });

  it('shows the recovery screen for corrupt data and the display hint in a host window', async () => {
    t = await createTestHost();
    t.app.phase.value = {
      kind: 'RECOVERY',
      cause: { code: 'LOG_CORRUPT', seq: 4, reason: 'INVALID_ENVELOPE' },
    };
    render(<App services={t} />);
    expect(screen.getByText('Daten können nicht geladen werden')).toBeInTheDocument();
    expect(
      screen.getByText('Fehlercode: LOG_CORRUPT/INVALID_ENVELOPE (Eintrag 4)'),
    ).toBeInTheDocument();
    t.app.phase.value = { kind: 'READY' };
    currentRoute.value = 'display';
    await screen.findByRole('button', { name: 'Anzeige öffnen' });
    fireEvent.click(screen.getByRole('button', { name: 'Anzeige öffnen' }));
    expect(t.platform.screen.openDisplay).toHaveBeenCalled();
  });
});

describe('RecoveryScreen', () => {
  it('exports raw data and resets only after the confirmation word', async () => {
    t = await createTestHost();
    const dump = vi.spyOn(t.platform.maintenance, 'dumpAll');
    const wipe = vi.spyOn(t.platform.maintenance, 'wipe');
    renderWithServices(<RecoveryScreen cause={{ code: 'MATCHES_CORRUPT', count: 2 }} />, t);
    expect(screen.getByText('Fehlercode: MATCHES_CORRUPT (2)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rohdaten exportieren' }));
    await waitFor(() => {
      expect(t?.platform.screen.download).toHaveBeenCalled();
    });
    expect(dump).toHaveBeenCalled();
    const reset = screen.getByRole('button', { name: 'Alles zurücksetzen' });
    expect(reset).toBeDisabled();
    fireEvent.input(screen.getByLabelText('Zum Bestätigen «ZURÜCKSETZEN» eintippen'), {
      target: { value: 'ZURÜCKSETZEN' },
    });
    expect(reset).toBeEnabled();
    expect(wipe).not.toHaveBeenCalled();
  });
});

describe('PinGate', () => {
  it('unlocks with the right PIN and offers a forgotten-PIN reset', async () => {
    t = await createTestHost();
    await t.pin.set('2468');
    t.pin.lock();
    renderWithServices(
      <PinGate>
        <p>Geschützt</p>
      </PinGate>,
      t,
    );
    const field = screen.getByLabelText('PIN');
    fireEvent.input(field, { target: { value: '1111' } });
    fireEvent.submit(present(field.closest('form'), 'form'));
    expect(await screen.findByText('Falsche PIN.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'PIN vergessen?' }));
    const dialog = await screen.findByRole('dialog', { name: 'PIN zurücksetzen' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.input(field, { target: { value: '2468' } });
    fireEvent.submit(present(field.closest('form'), 'form'));
    expect(await screen.findByText('Geschützt')).toBeInTheDocument();
  });

  it('removes a forgotten PIN after typing the confirmation', async () => {
    t = await createTestHost();
    await t.pin.set('2468');
    t.pin.lock();
    renderWithServices(
      <PinGate>
        <p>Geschützt</p>
      </PinGate>,
      t,
    );
    fireEvent.click(screen.getByRole('button', { name: 'PIN vergessen?' }));
    const dialog = await screen.findByRole('dialog', { name: 'PIN zurücksetzen' });
    fireEvent.input(within(dialog).getByLabelText('Zum Bestätigen «PIN ENTFERNEN» eintippen'), {
      target: { value: 'PIN ENTFERNEN' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'PIN entfernen' }));
    expect(await screen.findByText('Geschützt')).toBeInTheDocument();
    expect(t.pin.configured.value).toBe(false);
  });
});

describe('SystemBanners', () => {
  it('shows read-only, storage, memory and update notices', async () => {
    t = await createTestHost({ backend: 'MEMORY' });
    t.pwa.connect(true, () => Promise.resolve());
    t.pwa.markUpdateReady();
    const apply = vi.spyOn(t.pwa, 'apply');
    renderWithServices(<SystemBanners />, t);
    expect(screen.getByText(/Kein dauerhafter Speicher verfügbar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt aktualisieren' }));
    expect(apply).toHaveBeenCalled();
    fireEvent.click(present(screen.getAllByRole('button', { name: 'Jetzt exportieren' })[0]));
    await waitFor(() => {
      expect(t?.platform.screen.download).toHaveBeenCalled();
    });
  });

  it('offers a waiting update only between rounds (§10)', async () => {
    t = await createTestHost();
    t.pwa.connect(true, () => Promise.resolve());
    t.pwa.markUpdateReady();
    expect(t.host.startRound().ok).toBe(true);
    renderWithServices(<SystemBanners />, t);
    expect(screen.queryByRole('button', { name: 'Jetzt aktualisieren' })).toBeNull();
  });
});

describe('LazyRoute and ErrorBoundary', () => {
  it('loads a page, reports a failed chunk and catches render errors', async () => {
    t = await createTestHost();
    const Page = () => <p>Geladen</p>;
    renderWithServices(<LazyRoute id="ok" load={() => Promise.resolve({ default: Page })} />, t);
    expect(await screen.findByText('Geladen')).toBeInTheDocument();
    renderWithServices(
      <LazyRoute id="broken" load={() => Promise.reject(new Error('offline'))} />,
      t,
    );
    expect(await screen.findByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
    const Boom = () => {
      throw new Error('boom');
    };
    const onError = vi.fn();
    render(
      <ErrorBoundary resetKey="a" onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(await screen.findAllByText('Hier ist etwas schiefgelaufen')).toHaveLength(2);
    expect(onError).toHaveBeenCalled();
  });
});
