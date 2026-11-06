import { act, fireEvent, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStore } from '../../../application/app-store';
import { DisplayLink } from '../../../application/display-link';
import type { DisplayOverlay, DisplaySnapshot } from '../../../application/sync-messages';
import { present } from '../../../test/assert';
import { createTestPlatform, renderWithServices } from '../../../test/test-platform';
import { PwaState } from '../../../application/pwa';
import { MatchAdmin } from '../../../application/match-admin';
import { PinService } from '../../../application/pin';
import DisplayPage from './DisplayPage';
import { finishAll, play, wait } from './motion';

vi.mock('canvas-confetti', () => ({
  default: {
    create: () =>
      Object.assign(
        vi.fn(() => Promise.resolve()),
        { reset: vi.fn() },
      ),
  },
}));

let link: DisplayLink;
let seq = 0;

function snapshot(patch: Partial<DisplaySnapshot> = {}): DisplaySnapshot {
  seq += 1;
  return {
    v: 1,
    epoch: 1,
    seq,
    matchId: 'm',
    practice: false,
    phase: 'ROUND_RUNNING',
    round: 3,
    totalRounds: 24,
    ring: Array.from({ length: 24 }, (_, i) => (i < 2 ? 'DONE' : i === 2 ? 'CURRENT' : 'UPCOMING')),
    prize: {
      slot: 2,
      title: 'Präsentkorb',
      condition: { kind: 'ONE_LINE' },
      valueChf: 50,
      sponsor: 'Bäckerei',
    },
    progress: ['AWARDED', 'ACTIVE', 'UPCOMING', 'UPCOMING'],
    maxNumber: 90,
    drawn: [],
    theme: 'DARK',
    animation: 'NORMAL',
    performanceMode: false,
    locale: 'de-CH',
    ...patch,
  };
}

function push(next: DisplaySnapshot) {
  void act(() => {
    link.accept(next);
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const platform = createTestPlatform();
  const app = new AppStore(platform);
  await app.boot('display');
  link = new DisplayLink(app, 'display', vi.fn());
  renderWithServices(<DisplayPage />, {
    role: 'display',
    app,
    pwa: new PwaState(),
    admin: new MatchAdmin(app),
    pin: new PinService(app),
    display: link,
  });
});

afterEach(() => {
  link.dispose();
  vi.useRealTimers();
});

describe('DisplayPage: welcome page', () => {
  const ready = { phase: 'READY', date: '2026-11-21', venue: 'Mehrzweckhalle' } as const;

  it('greets the audience with the logo, date and venue before the first round', () => {
    push(snapshot(ready));
    const welcome = screen.getByRole('region', { name: 'Herzlich willkommen' });
    expect(welcome).toHaveTextContent('zum Lottomatch der FC Laufenburg-Kaisten Senioren');
    expect(welcome).toHaveTextContent('21.11.2026 · Mehrzweckhalle');
    expect(welcome).toHaveTextContent('Viel Glück!');
    expect(screen.getByRole('img', { name: 'FC Laufenburg-Kaisten' })).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(welcome);
  });

  it('leaves out date and venue that are not set', () => {
    push(snapshot({ phase: 'READY', date: '2026-11-21' }));
    expect(screen.getByText('21.11.2026')).toBeInTheDocument();
    push(snapshot({ phase: 'READY' }));
    expect(screen.queryByText('21.11.2026')).not.toBeInTheDocument();
    expect(screen.getByText('Herzlich willkommen')).toBeInTheDocument();
  });

  it('also greets while no event exists yet', () => {
    expect(screen.getByText('Herzlich willkommen')).toBeInTheDocument();
  });

  it('marks a practice event', () => {
    push(snapshot({ phase: 'READY', practice: true }));
    expect(screen.getByRole('region', { name: 'Herzlich willkommen' })).toHaveTextContent('ÜBUNG');
  });

  it('shows a pause over the welcome page', () => {
    push(
      snapshot({
        phase: 'READY',
        overlay: { kind: 'PAUSE', id: 'p', message: 'Kurze Pause', sponsors: [] },
      }),
    );
    expect(screen.getByRole('region', { name: 'Kurze Pause' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Herzlich willkommen' })).toBeInTheDocument();
  });

  it('gives way to the board with the event numbers when the first round starts', async () => {
    push(snapshot({ phase: 'READY', maxNumber: 75 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    push(snapshot({ maxNumber: 75 }));
    expect(screen.queryByText('Herzlich willkommen')).not.toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(75);
  });
});

describe('DisplayPage', () => {
  it('renders round, prize, board and the latest number without animation on first sight', () => {
    push(snapshot({ drawn: [7, 42], latest: { number: 42, seq: 2, method: 'RANDOM' } }));
    expect(screen.getByText('Runde 3 von 24')).toBeInTheDocument();
    expect(screen.getByText('Präsentkorb')).toBeInTheDocument();
    expect(screen.getByText('Preis 2 von 4')).toBeInTheDocument();
    expect(screen.getByText('Zuletzt gezogen: 42, Ziehung 2')).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: '42, zuletzt gezogen' })).toBeInTheDocument();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    // The display is one landmark: everything on it is the main content.
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('grid'));
  });

  it('reveals a new draw after the drum and lands it on the board', async () => {
    push(snapshot({ drawn: [7], latest: { number: 7, seq: 1, method: 'RANDOM' } }));
    push(
      snapshot({
        drawn: [7, 55],
        latest: { number: 55, seq: 2, method: 'RANDOM' },
        reveal: { key: 'k2', durationMs: 1_800, instant: false },
      }),
    );
    expect(screen.getByRole('gridcell', { name: '55, offen' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByRole('gridcell', { name: '55, zuletzt gezogen' })).toBeInTheDocument();
    expect(screen.getByText('Zuletzt gezogen: 55, Ziehung 2')).toBeInTheDocument();
  });

  it('jumps to the result when the host reveals at once, and follows undo', () => {
    push(snapshot());
    const base = { drawn: [9], latest: { number: 9, seq: 1, method: 'RANDOM' as const } };
    push(snapshot({ ...base, reveal: { key: 'k1', durationMs: 3_000, instant: false } }));
    push(snapshot({ ...base, reveal: { key: 'k1', durationMs: 3_000, instant: true } }));
    expect(screen.getByRole('gridcell', { name: '9, zuletzt gezogen' })).toBeInTheDocument();
    push(snapshot({ drawn: [], phase: 'ROUND_RUNNING' }));
    expect(screen.getByText('Gleich geht’s los')).toBeInTheDocument();
  });

  it('shows a gap by its slot name, practice lettering and the light theme', () => {
    push(
      snapshot({
        practice: true,
        theme: 'LIGHT',
        prize: { slot: 4, condition: { kind: 'FULL_CARD' } },
      }),
    );
    expect(screen.getAllByText('ÜBUNG').length).toBeGreaterThan(0);
    expect(screen.getByText('Preis 4')).toBeInTheDocument();
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('counts five prizes in a Superlotto round and rings the Superlotto', () => {
    const progress = ['AWARDED', 'ACTIVE', 'UPCOMING', 'UPCOMING', 'UPCOMING'] as const;
    push(snapshot({ progress: [...progress] }));
    expect(screen.getByText('Preis 2 von 5')).toBeInTheDocument();
    push(
      snapshot({
        prize: { slot: 5, title: 'Früchtekorb', condition: { kind: 'FULL_CARD' } },
        progress: ['AWARDED', 'AWARDED', 'AWARDED', 'AWARDED', 'ACTIVE'],
      }),
    );
    expect(screen.getByText('Superlotto')).toBeInTheDocument();
    expect(screen.getAllByText('SUPERLOTTO').length).toBeGreaterThan(0);
  });

  it.each<[DisplayOverlay, string]>([
    [
      {
        kind: 'WIN',
        id: 'o1',
        round: 3,
        slot: 5,
        title: 'Velo',
        condition: { kind: 'FULL_CARD' },
        winners: [{ cardNo: '17' }, { name: 'Anna' }],
        superlotto: true,
      },
      'Karte 17',
    ],
    [
      {
        kind: 'ROUND_END',
        id: 'o2',
        round: 3,
        next: { round: 4, prizes: [{ slot: 1, condition: { kind: 'ONE_LINE' }, title: 'Wein' }] },
      },
      'Runde 4: diese Preise warten',
    ],
    [{ kind: 'ROUND_END', id: 'o3', round: 24 }, 'Alle Runden sind gespielt'],
    [
      { kind: 'PAUSE', id: 'o4', message: 'Kurze Pause', resumeAt: '21:30', sponsors: ['A', 'B'] },
      'Weiter um 21:30 Uhr',
    ],
    [{ kind: 'PAUSE', id: 'o5', message: 'Pause', sponsors: ['Nur einer'] }, 'Nur einer'],
    [{ kind: 'GAME_END', id: 'o6', name: 'Lottomatch 2026' }, 'Danke fürs Mitspielen!'],
  ])('renders the %s overlay', (overlay, text) => {
    push(snapshot({ overlay }));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('rotates sponsors on the pause screen', async () => {
    push(
      snapshot({
        overlay: { kind: 'PAUSE', id: 'p', message: 'Pause', sponsors: ['Erster', 'Zweiter'] },
      }),
    );
    expect(screen.getByText('Erster')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });
    expect(screen.getByText('Zweiter')).toBeInTheDocument();
  });

  it('hides the cursor after 3 s and toggles fullscreen with F or a click', async () => {
    push(snapshot());
    const root = present(document.querySelector('h1')?.parentElement, 'display root');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(root.className).toMatch(/hideCursor/);
    fireEvent.pointerMove(window);
    expect(root.className).not.toMatch(/hideCursor/);
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.click(root);
    expect(screen.getByText('Klicken oder F drücken für Vollbild')).toBeInTheDocument();
  });
});

describe('motion helpers', () => {
  it('resolve without the Web Animations API and cancel waits', async () => {
    const running = new Set<Animation>();
    await expect(
      play(document.createElement('div'), [{ opacity: 0 }], { duration: 10 }, running),
    ).resolves.toBeUndefined();
    await expect(play(null, [], {}, running)).resolves.toBeUndefined();
    const pause = wait(10_000);
    pause.cancel();
    await expect(pause.promise).resolves.toBeUndefined();
    const animation = {
      finish: vi.fn(() => {
        throw new Error('x');
      }),
      cancel: vi.fn(),
    } as unknown as Animation;
    running.add(animation);
    finishAll(running);
    expect(running.size).toBe(0);
  });
});
