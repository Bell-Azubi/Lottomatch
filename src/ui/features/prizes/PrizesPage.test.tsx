import { fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrizeEditor } from '../../../application/prize-editor';
import { prizeAt, type PrizeDraft } from '../../../domain/catalogue';
import { prizes as m } from '../../../i18n/de-CH/prizes';
import { createTestHost, renderWithServices, type TestHost } from '../../../test/test-platform';
import { toasts } from '../../design-system/toast-store';
import PrizesPage from './PrizesPage';

const FRUIT_BASKET: PrizeDraft = {
  title: 'Grosser Früchtekorb',
  description: '',
  valueChf: undefined,
  sponsor: '',
  imageId: undefined,
  winCondition: { kind: 'FULL_CARD' },
};

function catalogue(host: TestHost) {
  const session = host.app.session.value;
  if (session === undefined) throw new Error('no session');
  return session.catalogue.value;
}

function slotSection(slotTitle: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: slotTitle, level: 3 });
  const section = heading.closest('section');
  if (section === null) throw new Error('slot section missing');
  return section;
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  return within(container).getByLabelText(label);
}

beforeEach(() => {
  toasts.value = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:prize'), revokeObjectURL: vi.fn() }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PrizesPage', () => {
  it('lists every round with completeness and gap warnings', async () => {
    const host = await createTestHost();
    renderWithServices(<PrizesPage />, host);
    expect(screen.getByRole('heading', { name: m.title, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(m.matrix.totalGaps(96))).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /bearbeiten$/ })).toHaveLength(24);
    expect(screen.getAllByText(m.matrix.gaps(4))).toHaveLength(24);
  });

  it('edits, saves, discards and removes a prize', async () => {
    const host = await createTestHost();
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(1) }));
    expect(screen.getByRole('heading', { name: m.editor.title(1), level: 2 })).toHaveFocus();
    const slot = slotSection('Preis 1');
    fireEvent.input(input(slot, m.form.title), { target: { value: 'Präsentkorb' } });
    fireEvent.input(input(slot, m.form.value), { target: { value: "1'000.50" } });
    fireEvent.click(within(slot).getByRole('button', { name: m.form.save }));
    expect(prizeAt(catalogue(host), 1, 1)).toMatchObject({
      title: 'Präsentkorb',
      valueChf: 1000.5,
    });
    expect(toasts.value.at(-1)?.message).toBe(m.form.saved('Preis 1'));
    fireEvent.input(input(slot, m.form.title), { target: { value: 'Anders' } });
    fireEvent.click(within(slot).getByRole('button', { name: m.form.discard }));
    expect(input(slot, m.form.title).value).toBe('Präsentkorb');
    fireEvent.click(within(slot).getByRole('button', { name: m.form.remove }));
    expect(prizeAt(catalogue(host), 1, 1)).toBeUndefined();
    expect(screen.getByText(m.matrix.totalGaps(96))).toBeInTheDocument();
  });

  it('shows inline errors and a custom rule field', async () => {
    const host = await createTestHost();
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(2) }));
    const slot = slotSection('Preis 4');
    fireEvent.input(input(slot, m.form.value), { target: { value: '-5' } });
    fireEvent.change(within(slot).getByLabelText(m.form.condition), {
      target: { value: 'CUSTOM' },
    });
    fireEvent.click(within(slot).getByRole('button', { name: m.form.save }));
    expect(within(slot).getByText(m.form.errors.titleRequired)).toBeInTheDocument();
    expect(within(slot).getByText(m.form.errors.value.NEGATIVE)).toBeInTheDocument();
    expect(within(slot).getByText(m.form.errors.customLabel)).toBeInTheDocument();
    fireEvent.input(input(slot, m.form.title), { target: { value: 'Velo' } });
    fireEvent.input(input(slot, m.form.value), { target: { value: '500' } });
    fireEvent.input(input(slot, m.form.customLabel), { target: { value: 'Vier Ecken' } });
    fireEvent.click(within(slot).getByRole('button', { name: m.form.save }));
    expect(prizeAt(catalogue(host), 2, 4)?.winCondition).toEqual({
      kind: 'CUSTOM',
      label: 'Vier Ecken',
    });
  });

  it('has a Superlotto form only in a round whose list has one', async () => {
    const host = await createTestHost();
    expect(new PrizeEditor(host.app).savePrize(4, 5, FRUIT_BASKET).ok).toBe(true);
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(3) }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    expect(screen.queryByRole('heading', { name: 'Superlotto', level: 3 })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(4) }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
    const slot = slotSection('Superlotto');
    expect(input(slot, m.form.title).value).toBe('Grosser Früchtekorb');
    expect(within(slot).getByLabelText(m.form.condition)).toHaveValue('FULL_CARD');
    expect(screen.getAllByText('Grosser Früchtekorb')).toHaveLength(2);
    expect(screen.getByText(m.matrix.complete(1, 5))).toBeInTheDocument();
    expect(screen.getAllByText(m.matrix.complete(0, 4))).toHaveLength(23);
    expect(screen.getByText(m.matrix.totalGaps(96))).toBeInTheDocument();
    fireEvent.input(input(slot, m.form.title), { target: { value: 'Riesiger Früchtekorb' } });
    fireEvent.click(within(slot).getByRole('button', { name: m.form.save }));
    expect(prizeAt(catalogue(host), 4, 5)?.title).toBe('Riesiger Früchtekorb');
    expect(toasts.value.at(-1)?.message).toBe(m.form.saved('Superlotto'));
    fireEvent.click(within(slot).getByRole('button', { name: m.form.remove }));
    expect(prizeAt(catalogue(host), 4, 5)).toBeUndefined();
    expect(screen.queryByRole('heading', { name: 'Superlotto', level: 3 })).toBeNull();
  });

  it('has no Superlotto form in a round that started without one', async () => {
    const host = await createTestHost();
    expect(host.host.startRound().ok).toBe(true);
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(1) }));
    expect(screen.queryByRole('heading', { name: 'Superlotto', level: 3 })).toBeNull();
  });

  it('keeps the form of a Superlotto removed from a running round', async () => {
    const host = await createTestHost();
    expect(new PrizeEditor(host.app).savePrize(1, 5, FRUIT_BASKET).ok).toBe(true);
    expect(host.host.startRound().ok).toBe(true);
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(1) }));
    fireEvent.click(within(slotSection('Superlotto')).getByRole('button', { name: m.form.remove }));
    await waitFor(() => {
      expect(screen.getByText(m.editor.gap('Superlotto'))).toBeInTheDocument();
    });
    expect(screen.getByText(m.matrix.complete(0, 5))).toBeInTheDocument();
  });

  it('uploads and removes an image', async () => {
    const host = await createTestHost();
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(3) }));
    const slot = slotSection('Preis 2');
    fireEvent.input(input(slot, m.form.title), { target: { value: 'Velo' } });
    const file = new File(['png'], 'bild.png', { type: 'image/png' });
    fireEvent.change(within(slot).getByLabelText(m.image.choose), { target: { files: [file] } });
    await waitFor(() => {
      expect(within(slot).getByRole('img', { name: m.image.alt('Velo') })).toBeInTheDocument();
    });
    fireEvent.click(within(slot).getByRole('button', { name: m.form.save }));
    expect(prizeAt(catalogue(host), 3, 2)?.imageId).toBeDefined();
    fireEvent.click(within(slot).getByRole('button', { name: m.image.remove }));
    fireEvent.click(within(slot).getByRole('button', { name: m.form.save }));
    expect(prizeAt(catalogue(host), 3, 2)?.imageId).toBeUndefined();
  });

  it('reports image errors', async () => {
    const host = await createTestHost({
      imageProcessor: { process: () => Promise.resolve({ ok: false, error: 'HEIC_UNSUPPORTED' }) },
    });
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(1) }));
    const slot = slotSection('Preis 3');
    fireEvent.change(within(slot).getByLabelText(m.image.choose), {
      target: { files: [new File(['x'], 'a.heic', { type: 'image/heic' })] },
    });
    expect(await within(slot).findByRole('alert')).toHaveTextContent(
      m.image.errors.HEIC_UNSUPPORTED,
    );
  });

  it('keeps awarded prizes read-only', async () => {
    const host = await createTestHost();
    host.host.startRound();
    host.host.award({ winners: [{ cardNo: '12' }] });
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.matrix.editRound(1) }));
    expect(within(slotSection('Preis 1')).getByText(m.editor.awarded)).toBeInTheDocument();
    expect(screen.getAllByText(/vergeben/).length).toBeGreaterThan(0);
  });

  it('disables editing in a read-only window', async () => {
    const host = await createTestHost();
    host.app.setWriteGuard(() => false);
    Object.assign(host.hostLink.control, { value: 'READ_ONLY' });
    renderWithServices(<PrizesPage />, host);
    expect(screen.getByText(m.readOnly)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m.csv.import })).toBeDisabled();
    expect(screen.getByRole('button', { name: m.bulk.copy })).toBeDisabled();
  });

  it('exports CSV, prints and shows the payout indicator', async () => {
    const host = await createTestHost();
    const session = host.app.session.value;
    if (session === undefined) throw new Error('no session');
    session.updateSettings(
      {
        ...session.match.value.settings,
        payout: { enabled: true, minRatioPercent: 50, stakesChf: 1000 },
      },
      [],
    );
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const download = vi.spyOn(host.platform.screen, 'download');
    renderWithServices(<PrizesPage />, host);
    fireEvent.click(screen.getByRole('button', { name: m.csv.export }));
    expect(download).toHaveBeenCalledWith(
      expect.stringMatching(/^preise-lottomatch-\d{4}-\d{2}-\d{2}\.csv$/),
      expect.any(Blob),
    );
    fireEvent.click(screen.getByRole('button', { name: m.print.button }));
    expect(print).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: m.payout.title })).toBeInTheDocument();
    expect(screen.getByText(m.payout.below)).toBeInTheDocument();
  });
});
