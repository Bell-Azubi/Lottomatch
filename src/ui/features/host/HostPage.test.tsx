import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { present } from '../../../test/assert';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import HostPage from './HostPage';
import { manualBuffer } from './manual-buffer';

let t: TestHost;

function key(value: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document, { key: value, ...init });
}

function drawnCount() {
  return t.app.session.value?.game.value.rounds.get(
    t.app.session.value.game.value.currentRound ?? 1,
  )?.draws.length;
}

async function startFirstRound() {
  fireEvent.click(present(screen.getAllByRole('button', { name: 'Runde 1 starten' })[0]));
  fireEvent.click(await screen.findByRole('button', { name: 'Trotzdem starten' }));
  await screen.findByRole('button', { name: 'Drehen' });
}

beforeEach(async () => {
  t = await createTestHost();
  t.app.setPreferences({ animation: 'OFF' });
  manualBuffer.value = '';
  renderWithServices(<HostPage />, t);
});

afterEach(() => {
  t.hostLink.dispose();
});

describe('HostPage', () => {
  it('starts the first round after confirming the prize gaps', async () => {
    expect(screen.getByText('Noch keine Runde gestartet')).toBeInTheDocument();
    await startFirstRound();
    expect(screen.getByText('Preis 1 von 4 · 1 Linie')).toBeInTheDocument();
    expect(screen.getByText('0 von 90 gezogen')).toBeInTheDocument();
  });

  it('draws with Space and digits + Enter, undoes with Ctrl+Z (FR-2, FR-3, FR-12)', async () => {
    await startFirstRound();
    key(' ');
    await screen.findByText('1 von 90 gezogen');
    key('4');
    key('2');
    expect(manualBuffer.value).toBe('42');
    expect(drawnCount()).toBe(1);
    key('Enter');
    await screen.findByText('2 von 90 gezogen');
    expect(screen.getByRole('gridcell', { name: '42, zuletzt gezogen' })).toBeInTheDocument();
    key('z', { ctrlKey: true });
    await screen.findByText('1 von 90 gezogen');
    key('9');
    key('Backspace');
    key('7');
    key('Escape');
    expect(manualBuffer.value).toBe('');
  });

  it('validates typed numbers inline and confirms board clicks', async () => {
    await startFirstRound();
    const field = screen.getByLabelText('Zahl aus der Trommel');
    fireEvent.input(field, { target: { value: '91' } });
    fireEvent.submit(present(field.closest('form'), 'form'));
    await screen.findByText('Die Zahl muss zwischen 1 und 90 liegen.');
    fireEvent.input(field, { target: { value: 'x' } });
    fireEvent.submit(present(field.closest('form'), 'form'));
    await screen.findByText('Nur Ziffern 0–9 erlaubt.');
    fireEvent.click(screen.getByRole('gridcell', { name: '50, offen' }));
    const dialog = await screen.findByRole('dialog', { name: '50 als gezogen markieren?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Als gezogen markieren' }));
    await screen.findByRole('gridcell', { name: '50, zuletzt gezogen' });
    fireEvent.input(field, { target: { value: '50' } });
    fireEvent.submit(present(field.closest('form'), 'form'));
    await screen.findByText('50 ist in dieser Runde bereits gezogen.');
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ziffer löschen' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eintragen' }));
    await screen.findByRole('gridcell', { name: '8, zuletzt gezogen' });
  });

  it('opens dialogs and windows from the keyboard', async () => {
    await startFirstRound();
    key('?');
    expect(await screen.findByRole('dialog', { name: 'Tastenkürzel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Schliessen' }));
    key('a');
    await waitFor(() => {
      expect(t.platform.screen.openDisplay).toHaveBeenCalled();
    });
    key('f');
    expect(t.platform.screen.toggleFullscreen).toHaveBeenCalled();
    key('p');
    expect(t.host.overlays.state.value?.kind).toBe('PAUSE');
    expect(screen.getByRole('button', { name: 'Pause beenden' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pause beenden' }));
    expect(t.host.overlays.state.value).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    const pause = await screen.findByRole('dialog', { name: 'Pause' });
    fireEvent.input(within(pause).getByLabelText('Weiter um (HH:MM, optional)'), {
      target: { value: '21:45' },
    });
    fireEvent.click(within(pause).getByRole('button', { name: 'Pause anzeigen' }));
    expect(t.host.overlays.state.value).toMatchObject({ kind: 'PAUSE', resumeAt: '21:45' });
    key('g');
    expect(await screen.findByRole('dialog', { name: /Gewinn prüfen/ })).toBeInTheDocument();
    key(' ');
    expect(drawnCount()).toBe(0);
  });

  it('disables Drehen with the reason once the pool is empty (FR-2, §12)', async () => {
    const session = present(t.app.session.value, 'session');
    session.updateSettings({ ...session.match.value.settings, maxNumber: 30 }, []);
    await startFirstRound();
    for (let number = 1; number <= 30; number += 1) expect(t.host.drawManual(number).ok).toBe(true);
    expect(
      await screen.findByText('Alle Zahlen sind gezogen. Gewinn prüfen oder Preis überspringen.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drehen' })).toBeDisabled();
    key(' ');
    expect(drawnCount()).toBe(30);
  });

  it('ignores shortcuts while focus is in a text field (§12)', async () => {
    await startFirstRound();
    const field = screen.getByLabelText('Zahl aus der Trommel');
    field.focus();
    for (const value of ['g', 'p', '?', 'a', ' ']) fireEvent.keyDown(field, { key: value });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(t.host.overlays.state.value).toBeUndefined();
    expect(t.platform.screen.openDisplay).not.toHaveBeenCalled();
    expect(drawnCount()).toBe(0);
  });

  it('runs host overrides with reasons (FR-5)', async () => {
    await startFirstRound();
    key(' ');
    const open = async (label: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Spielleitung' }));
      const dialog = await screen.findByRole('dialog', { name: 'Spielleitung' });
      fireEvent.click(within(dialog).getByRole('button', { name: label }));
      return dialog;
    };
    let dialog = await open('Preis überspringen');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigen' }));
    expect(await within(dialog).findByText('Bitte einen Grund angeben.')).toBeInTheDocument();
    fireEvent.input(within(dialog).getByLabelText('Grund (wird protokolliert)'), {
      target: { value: 'Kein Preis' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigen' }));
    await screen.findByText('Preis 2 von 4 · 1 Linie');
    dialog = await open('Zu Runde springen');
    fireEvent.change(within(dialog).getByLabelText('Runde'), { target: { value: '5' } });
    fireEvent.input(within(dialog).getByLabelText('Grund (wird protokolliert)'), {
      target: { value: 'Zeitplan' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigen' }));
    await waitFor(() => {
      expect(t.app.session.value?.game.value.currentRound).toBe(5);
    });
    dialog = await open('Runde abbrechen');
    fireEvent.input(within(dialog).getByLabelText('Grund (wird protokolliert)'), {
      target: { value: 'Ende' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigen' }));
    expect(
      (await screen.findAllByRole('button', { name: 'Runde 5 starten' })).length,
    ).toBeGreaterThan(0);
    dialog = await open('Anlass abschliessen');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigen' }));
    await screen.findByRole('heading', { name: 'Anlass abgeschlossen' });
  });

  it('revokes the latest win and shows the round summary after the Hauptpreis', async () => {
    await startFirstRound();
    for (let slot = 1; slot <= 4; slot += 1) t.host.award({ winners: [{ cardNo: String(slot) }] });
    await screen.findByRole('heading', { name: 'Runde 1 ist fertig' });
    expect(screen.getByText('Nächste Runde: 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rundenende anzeigen' }));
    expect(t.host.overlays.state.value?.kind).toBe('ROUND_END');
    fireEvent.click(screen.getByRole('button', { name: 'Spielleitung' }));
    const dialog = await screen.findByRole('dialog', { name: 'Spielleitung' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Letzten Gewinn widerrufen' }));
    fireEvent.input(within(dialog).getByLabelText('Grund (wird protokolliert)'), {
      target: { value: 'Falsch' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bestätigen' }));
    await screen.findByRole('button', { name: 'Drehen' });
    expect(screen.getByText('Preis 4 von 4 · Volle Karte')).toBeInTheDocument();
  });

  it('locks every control in a read-only window', async () => {
    await startFirstRound();
    t.app.setWriteGuard(() => false);
    await t.hostLink.takeOver().catch(() => undefined);
    t.app.setWriteGuard(() => false);
    key(' ');
    expect(drawnCount()).toBe(0);
  });
});
