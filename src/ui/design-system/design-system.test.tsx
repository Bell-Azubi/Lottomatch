import { signal } from '@preact/signals';
import { act, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { present } from '../../test/assert';
import { createTestPlatform } from '../../test/test-platform';
import { Board } from '../features/board/Board';
import { createBoardModel } from '../features/board/board-state';
import { arcPath, BadgeRing } from './BadgeRing';
import { Dialog, openDialogCount } from './Dialog';
import { Logo, LOGO_URL } from './Logo';
import { SelectField, TextArea, TextField, Toggle } from './Field';
import { PrizeImage } from './PrizeImage';
import { Ball, PrizeProgress, RoundRing } from './Rings';
import { Toaster } from './Toaster';
import { dismissToast, showToast, toasts } from './toast-store';

afterEach(() => {
  toasts.value = [];
  vi.useRealTimers();
});

describe('BadgeRing (single ring primitive)', () => {
  it('runs both lettering arcs left to right so they read upright', () => {
    const { container } = render(
      <BadgeRing topText="RUNDE 7 VON 24" bottomText="ZIEHUNG 37" numeral="42" />,
    );
    const paths = [...container.querySelectorAll('path')].map((path) => path.getAttribute('d'));
    // Top: from the left edge clockwise over 12 o'clock; bottom: from the left counter-clockwise through 6 o'clock.
    expect(paths).toContain('M 23 100 A 77 77 0 0 1 177 100');
    expect(paths).toContain('M 11 100 A 89 89 0 0 0 189 100');
    const textPaths = [...container.querySelectorAll('textPath')];
    expect(textPaths.map((tp) => tp.textContent)).toEqual(['RUNDE 7 VON 24', 'ZIEHUNG 37']);
    expect(
      textPaths.every(
        (tp) =>
          tp.getAttribute('startOffset') === '50%' && tp.getAttribute('text-anchor') === 'middle',
      ),
    ).toBe(true);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('text:not(:has(textPath))')?.textContent).toBe('42');
  });

  it('turns the band red for the Hauptpreis and draws segments and progress', () => {
    const { container } = render(<BadgeRing bandTone="red" topText="HAUPTPREIS" />);
    expect(container.querySelector('[data-layer="band"] circle')?.getAttribute('class')).toMatch(
      /bandRed/,
    );
    const ring = render(
      <BadgeRing
        variant="ring"
        segments={['DONE', 'CURRENT', 'UPCOMING', 'ABORTED']}
        progress={0.5}
      />,
    );
    expect(ring.container.querySelectorAll('[data-layer="band"]')).toHaveLength(0);
    expect(ring.container.querySelectorAll('path')).toHaveLength(4);
    const single = render(<BadgeRing variant="ring" segments={['CURRENT']} sweepMs={800} />);
    expect(single.container.querySelector('circle[style]')).not.toBeNull();
    expect(arcPath(88, 0, 270)).toMatch(/A 88 88 0 1 1/);
  });

  it('renders rings with real text beside them', () => {
    render(<RoundRing round={7} total={24} segments={[]} size="lg" />);
    expect(screen.getByText('Runde 7 von 24')).toBeInTheDocument();
    render(<RoundRing round={undefined} total={24} segments={['DONE', 'UPCOMING']} />);
    expect(screen.getByText('1 von 24 Runden gespielt')).toBeInTheDocument();
    render(<PrizeProgress states={['AWARDED', 'ACTIVE', 'SKIPPED', 'UPCOMING']} />);
    expect(screen.getByText('Preis 3: übersprungen')).toBeInTheDocument();
    expect(screen.getByText('Hauptpreis: offen')).toBeInTheDocument();
    render(<Ball number={42} label="42" />);
  });
});

describe('board (FR-1)', () => {
  it('re-renders cells from their own signals and supports roving focus', () => {
    const drawn = signal<readonly number[]>([]);
    const latest = signal<number | undefined>(undefined);
    const model = createBoardModel(drawn, latest, signal(25));
    const pick = vi.fn();
    render(<Board model={model} onPick={pick} />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(25);
    void act(() => {
      drawn.value = [3, 9];
      latest.value = 9;
    });
    expect(screen.getByRole('gridcell', { name: '9, zuletzt gezogen' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: '3, gezogen' })).toBeInTheDocument();
    expect(model.drawnCount.value).toBe(2);
    fireEvent.click(screen.getByRole('gridcell', { name: '3, gezogen' }));
    expect(pick).not.toHaveBeenCalled();
    const first = screen.getByRole('gridcell', { name: '1, offen' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('gridcell', { name: '2, offen' }));
    fireEvent.keyDown(present(document.activeElement), { key: 'ArrowDown' });
    fireEvent.keyDown(present(document.activeElement), { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('gridcell', { name: '25, offen' }));
    fireEvent.keyDown(present(document.activeElement), { key: 'ArrowRight' });
    fireEvent.keyDown(present(document.activeElement), { key: 'Home' });
    fireEvent.keyDown(present(document.activeElement), { key: 'x' });
    fireEvent.click(screen.getByRole('gridcell', { name: '1, offen' }));
    expect(pick).toHaveBeenCalledWith(1);
    render(<Board model={model} size="display" />);
  });
});

describe('fields, dialogs and toasts', () => {
  it('wires labels, hints and errors', () => {
    // Preact ids are unique per render root, so each field gets its own root in turn.
    const onValue = vi.fn();
    let view = render(
      <TextField label="Titel" value="" onValue={onValue} hint="Pflicht" error="Fehlt" />,
    );
    const input = screen.getByLabelText('Titel');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toMatch(/hint.*error/);
    fireEvent.input(input, { target: { value: 'Velo' } });
    expect(onValue).toHaveBeenCalledWith('Velo');
    view.unmount();
    view = render(<TextArea label="Beschreibung" value="" onValue={onValue} maxLength={10} />);
    fireEvent.input(screen.getByLabelText('Beschreibung'), { target: { value: 'x' } });
    view.unmount();
    view = render(
      <SelectField
        label="Thema"
        value="A"
        options={[
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ]}
        onValue={onValue}
      />,
    );
    fireEvent.change(screen.getByLabelText('Thema'), { target: { value: 'B' } });
    expect(onValue).toHaveBeenCalledWith('B');
    view.unmount();
    const onToggle = vi.fn();
    render(<Toggle label="Ton" checked={false} onChange={onToggle} hint="aus" />);
    fireEvent.click(screen.getByRole('switch', { name: /Ton/ }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('counts open dialogs and closes on Escape (cancel)', () => {
    const onClose = vi.fn();
    const view = render(
      <Dialog open title="Test" onClose={onClose} actions={<button type="button">OK</button>}>
        <p>Inhalt</p>
      </Dialog>,
    );
    expect(openDialogCount.value).toBe(1);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
    view.unmount();
    expect(openDialogCount.value).toBe(0);
  });

  it('shows, replaces, auto-dismisses and acts on toasts', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    render(<Toaster />);
    void act(() => {
      showToast('Gespeichert');
      showToast('Fehler', {
        tone: 'error',
        id: 'e',
        persistent: true,
        action: { label: 'Nochmals', run },
      });
      showToast('Fehler 2', { tone: 'error', id: 'e', persistent: true });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Fehler 2');
    void act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByText('Gespeichert')).toBeNull();
    void act(() => {
      showToast('Mit Aktion', { action: { label: 'Tun', run } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tun' }));
    expect(run).toHaveBeenCalled();
    fireEvent.click(present(screen.getAllByRole('button', { name: 'Schliessen' })[0]));
    void act(() => {
      dismissToast('e');
    });
    expect(screen.queryByText('Fehler 2')).toBeNull();
  });

  it('shows stored prize images and nothing for missing ones', async () => {
    const images = createTestPlatform().images;
    await images.put({
      id: 'p',
      blob: new Blob(['x'], { type: 'image/webp' }),
      width: 1,
      height: 1,
      createdAt: '',
    });
    const create = vi.fn(() => 'blob:prize');
    const revoke = vi.fn();
    // A subclass keeps the real URL untouched; `unstubGlobals` restores it after the test.
    class StubUrl extends URL {
      static override createObjectURL = create;
      static override revokeObjectURL = revoke;
    }
    vi.stubGlobal('URL', StubUrl);
    const view = render(<PrizeImage images={images} imageId="p" alt="Velo" />);
    expect(await screen.findByRole('img', { name: 'Velo' })).toHaveAttribute('src', 'blob:prize');
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:prize');
    const missing = render(<PrizeImage images={images} imageId="gone" alt="Weg" />);
    await act(() => Promise.resolve());
    expect(missing.container.querySelector('img')).toBeNull();
  });
});

describe('Logo', () => {
  it('keeps the supplied size cap and follows a larger replacement file', () => {
    const { container } = render(<Logo size="display" />);
    const img = screen.getByRole('img', { name: 'FC Laufenburg-Kaisten' });
    const frame = present(img.parentElement, 'logo frame');
    expect(img).toHaveAttribute('src', LOGO_URL);
    fireEvent.load(img);
    expect(frame.style.getPropertyValue('--logo-max')).toBe('');
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 1024 });
    fireEvent.load(img);
    expect(frame.style.getPropertyValue('--logo-max')).toBe('1024px');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
