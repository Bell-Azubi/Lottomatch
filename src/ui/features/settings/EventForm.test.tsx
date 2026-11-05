import { fireEvent, screen, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { EventForm } from './EventForm';

function settingsOf(test: TestHost) {
  const session = test.app.session.value;
  if (session === undefined) throw new Error('no session');
  return session.match.value.settings;
}

function type(label: string | RegExp, value: string): void {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

function save(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));
}

function messages(): string[] {
  return toasts.value.map((toast) => toast.message);
}

beforeEach(() => {
  toasts.value = [];
});

describe('Anlass form', () => {
  it('saves changed settings and reports unchanged ones', async () => {
    const test = await createTestHost();
    renderWithServices(<EventForm canEdit />, test);
    save();
    expect(messages()).toEqual(['Keine Änderungen']);
    type('Name', '  Herbstlotto  ');
    type('Datum', '2026-11-14');
    type('Ort (optional)', 'Mehrzweckhalle Kaisten');
    type('Anzahl Runden', '20');
    type(/^Höchste Zahl/, '75');
    type('Zahlen pro Linie', '4');
    type('Linien pro Karte', '2');
    fireEvent.change(screen.getByLabelText('Verspätete Meldungen'), {
      target: { value: 'REJECT' },
    });
    fireEvent.change(screen.getByLabelText('Mehrere Gewinnkarten'), { target: { value: 'SHARE' } });
    fireEvent.click(screen.getByRole('switch', { name: /Brett nach jedem Preis leeren/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Namen auf der Anzeige zeigen/ }));
    fireEvent.input(screen.getByRole('textbox', { name: 'Sponsoren (eine Zeile pro Sponsor)' }), {
      target: { value: 'Bäckerei Muster\n\nGarage Beispiel' },
    });
    save();
    expect(settingsOf(test)).toMatchObject({
      name: 'Herbstlotto',
      date: '2026-11-14',
      venue: 'Mehrzweckhalle Kaisten',
      rounds: 20,
      maxNumber: 75,
      perLine: 4,
      lines: 2,
      lateClaimPolicy: 'REJECT',
      tiePolicy: 'SHARE',
      boardReset: 'PRIZE',
      showNamesOnDisplay: true,
      sponsors: ['Bäckerei Muster', 'Garage Beispiel'],
    });
    expect(messages()).toContain('Einstellungen gespeichert');
    expect(screen.getByLabelText('Name')).toHaveValue('Herbstlotto');
    expect(screen.getByText('Eine volle Karte hat 8 Zahlen.')).toBeInTheDocument();
  });

  it('shows field errors and keeps the stored settings', async () => {
    const test = await createTestHost();
    renderWithServices(<EventForm canEdit />, test);
    type('Name', ' ');
    type('Anzahl Runden', '0');
    type('Zahlen pro Linie', '9');
    type('Linien pro Karte', '6');
    type(/^Höchste Zahl/, '30');
    save();
    expect(screen.getByText('Bitte einen Namen eingeben.')).toBeInTheDocument();
    expect(screen.getByText('1 bis 50 Runden.')).toBeInTheDocument();
    expect(screen.getByText('Eine Karte hat mehr Zahlen, als das Brett hat.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(messages()).toContain('Bitte die markierten Felder korrigieren.');
    expect(settingsOf(test).name).toBe('Lottomatch');
  });

  it('edits custom win rules in the template', async () => {
    const test = await createTestHost();
    renderWithServices(<EventForm canEdit />, test);
    fireEvent.change(screen.getByLabelText('Gewinnregel Preis 2'), { target: { value: 'CUSTOM' } });
    save();
    expect(
      screen.getByText('Eine eigene Regel braucht eine Bezeichnung (höchstens 60 Zeichen).'),
    ).toBeInTheDocument();
    type('Eigene Regel für Preis 2', 'Vier Ecken');
    save();
    expect(settingsOf(test).template[2]).toEqual({ kind: 'CUSTOM', label: 'Vier Ecken' });
    expect(screen.getByLabelText('Gewinnregel Hauptpreis')).toHaveValue('FULL_CARD');
  });

  it('validates the payout indicator', async () => {
    const test = await createTestHost();
    renderWithServices(<EventForm canEdit />, test);
    const stakes = screen.getByLabelText('Einsätze total in CHF');
    expect(stakes).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: /Quote anzeigen/ }));
    type('Einsätze total in CHF', 'viel');
    save();
    expect(screen.getByText(/Einsätze als CHF-Betrag/)).toBeInTheDocument();
    type('Einsätze total in CHF', "4'500.–");
    type('Mindestquote in %', '60');
    save();
    expect(settingsOf(test).payout).toEqual({
      enabled: true,
      stakesChf: 4500,
      minRatioPercent: 60,
    });
  });

  it('locks N, card layout and board reset while a round runs (I6)', async () => {
    const test = await createTestHost();
    expect(test.host.startRound().ok).toBe(true);
    renderWithServices(<EventForm canEdit />, test);
    for (const label of [/^Höchste Zahl/, 'Zahlen pro Linie', 'Linien pro Karte']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole('switch', { name: /Brett nach jedem Preis leeren/ })).toBeDisabled();
    expect(screen.getAllByText('Gesperrt, solange eine Runde läuft.').length).toBeGreaterThan(0);
    type('Ort (optional)', 'Turnhalle');
    save();
    expect(settingsOf(test).venue).toBe('Turnhalle');
    expect(test.app.session.value?.log.at(-1)?.event.type).toBe('SETTINGS_CHANGED');
  });

  it('keeps the number of rounds at or above the highest started round', async () => {
    const test = await createTestHost();
    expect(test.host.jumpToRound(7, 'Spätstart').ok).toBe(true);
    renderWithServices(<EventForm canEdit />, test);
    expect(screen.getByText('1 bis 50, mindestens 7 (bereits gestartet)')).toBeInTheDocument();
    type('Anzahl Runden', '5');
    save();
    expect(
      screen.getByText('Mindestens 7: so viele Runden wurden schon gestartet.'),
    ).toBeInTheDocument();
  });

  it('disables every field without control of the game', async () => {
    const test = await createTestHost();
    renderWithServices(<EventForm canEdit={false} />, test);
    const form = screen.getByRole('button', { name: 'Einstellungen speichern' }).closest('form');
    if (form === null) throw new Error('form missing');
    expect(within(form).getByLabelText('Name')).toBeDisabled();
    expect(within(form).getByRole('textbox', { name: /Sponsoren/ })).toBeDisabled();
    expect(within(form).getByRole('button', { name: 'Einstellungen speichern' })).toBeDisabled();
  });
});
