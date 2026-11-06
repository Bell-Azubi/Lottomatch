import { fireEvent, render, screen, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrizeEditor } from '../../../application/prize-editor';
import { prizeAt } from '../../../domain/catalogue';
import type { Prize } from '../../../domain/types';
import { prizes as m } from '../../../i18n/de-CH/prizes';
import { createTestHost, type TestHost } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import { PrizeForm } from './PrizeForm';

const PRIZE: Prize = {
  id: 'p1',
  round: 1,
  slot: 3,
  title: 'Raclette-Ofen',
  description: 'Für acht Personen',
  valueChf: 120,
  sponsor: 'Elektro Muster AG',
  winCondition: { kind: 'TWO_LINES' },
};

function view(
  host: TestHost,
  prize: Prize | undefined,
  options: { awarded?: boolean; readOnly?: boolean } = {},
) {
  const editor = new PrizeEditor(host.app);
  const props = {
    editor,
    images: host.platform.images,
    round: 1,
    slot: 3 as const,
    fallback: { kind: 'TWO_LINES' as const },
    awarded: options.awarded ?? false,
    readOnly: options.readOnly ?? false,
  };
  const result = render(<PrizeForm {...props} prize={prize} />);
  return {
    ...result,
    editor,
    update: (next: Prize | undefined) => {
      result.rerender(<PrizeForm {...props} prize={next} />);
    },
  };
}

function stored(host: TestHost) {
  const session = host.app.session.value;
  if (session === undefined) throw new Error('no session');
  return prizeAt(session.catalogue.value, 1, 3);
}

beforeEach(() => {
  toasts.value = [];
});

describe('PrizeForm', () => {
  it('offers 2 Reihen only for a prize that already has it (ADR-0026)', async () => {
    const host = await createTestHost();
    const choices = () =>
      within(screen.getByLabelText(m.form.condition))
        .getAllByRole('option')
        .map((option) => option.textContent);
    const current = view(host, { ...PRIZE, winCondition: { kind: 'ONE_LINE' } });
    expect(choices()).toEqual(['1 Reihe', 'Volle Karte', 'Eigene Regel']);
    current.unmount();
    view(host, PRIZE);
    expect(screen.getByLabelText(m.form.condition)).toHaveValue('TWO_LINES');
    expect(choices()).toContain('2 Reihen');
  });

  it('edits description and sponsor and saves them', async () => {
    const host = await createTestHost();
    view(host, undefined);
    fireEvent.input(screen.getByLabelText(m.form.title), { target: { value: 'Fondue-Set' } });
    fireEvent.input(screen.getByLabelText(m.form.description), {
      target: { value: 'Mit Caquelon' },
    });
    fireEvent.input(screen.getByLabelText(m.form.sponsor), { target: { value: 'Käserei Muster' } });
    fireEvent.click(screen.getByRole('button', { name: m.form.save }));
    expect(stored(host)).toMatchObject({
      title: 'Fondue-Set',
      description: 'Mit Caquelon',
      sponsor: 'Käserei Muster',
    });
  });

  it('follows external changes unless the form has unsaved edits', async () => {
    const host = await createTestHost();
    const { update } = view(host, PRIZE);
    update({ ...PRIZE, title: 'Neuer Titel' });
    expect(screen.getByLabelText<HTMLInputElement>(m.form.title).value).toBe('Neuer Titel');
    fireEvent.input(screen.getByLabelText(m.form.sponsor), { target: { value: 'Eigener Text' } });
    update({ ...PRIZE, title: 'Noch neuer' });
    expect(screen.getByLabelText<HTMLInputElement>(m.form.sponsor).value).toBe('Eigener Text');
    expect(screen.getByLabelText<HTMLInputElement>(m.form.title).value).toBe('Neuer Titel');
  });

  it('reports failed saves and removals', async () => {
    const host = await createTestHost();
    view(host, PRIZE);
    host.app.setWriteGuard(() => false);
    fireEvent.input(screen.getByLabelText(m.form.title), { target: { value: 'Anders' } });
    fireEvent.click(screen.getByRole('button', { name: m.form.save }));
    expect(toasts.value.at(-1)).toMatchObject({ message: m.errors.READ_ONLY, tone: 'error' });
    fireEvent.click(screen.getByRole('button', { name: m.form.remove }));
    expect(toasts.value).toHaveLength(2);
  });

  it('shows awarded prizes read-only with all details', async () => {
    const host = await createTestHost();
    view(host, PRIZE, { awarded: true });
    expect(screen.getByText(m.editor.awarded)).toBeInTheDocument();
    expect(screen.getByText('Für acht Personen')).toBeInTheDocument();
    expect(screen.getByText(/CHF\s?120\.00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: m.form.save })).not.toBeInTheDocument();
  });

  it('shows only the notice for an awarded gap and disables a read-only form', async () => {
    const host = await createTestHost();
    const { unmount } = view(host, undefined, { awarded: true });
    expect(screen.getByText(m.editor.awarded)).toBeInTheDocument();
    unmount();
    view(host, PRIZE, { readOnly: true });
    expect(screen.getByLabelText(m.form.title)).toBeDisabled();
    expect(screen.getByRole('button', { name: m.form.remove })).toBeDisabled();
  });
});
