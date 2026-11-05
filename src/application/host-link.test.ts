import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestPlatform, LoopbackBus, TestClock } from '../test/test-platform';
import { AppStore } from './app-store';
import { DisplayLink } from './display-link';
import { HostController } from './host-controller';
import { HostLink, TAKEOVER_WAIT_MS } from './host-link';
import type { HostLock } from './ports';
import type { DisplaySnapshot } from './sync-messages';

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});

/** One Web Lock shared by the windows of a test, with steal semantics. */
function sharedLock() {
  let holder: (() => void) | undefined;
  const lock = (): HostLock => {
    let mine: (() => void) | undefined;
    return {
      acquire: (onLost) => {
        if (holder !== undefined) return Promise.resolve('HELD_ELSEWHERE');
        mine = onLost;
        holder = onLost;
        return Promise.resolve('ACQUIRED');
      },
      steal: (onLost) => {
        const previous = holder;
        holder = onLost;
        mine = onLost;
        if (previous !== undefined && previous !== onLost) previous();
        return Promise.resolve();
      },
      release: () => {
        if (holder === mine) holder = undefined;
      },
    };
  };
  return lock;
}

async function window(
  bus: LoopbackBus,
  lock: HostLock,
  shared: ReturnType<typeof createTestPlatform>,
  id: string,
) {
  const platform = { ...shared, sync: bus.transport(), lock };
  const app = new AppStore(platform);
  const host = new HostController(app);
  const link = new HostLink(app, host, id);
  await link.start();
  await app.boot('host');
  disposers.push(() => {
    link.dispose();
  });
  return { app, host, link };
}

describe('HostLink', () => {
  it('controls the event and publishes ordered snapshots', async () => {
    const bus = new LoopbackBus();
    const base = createTestPlatform();
    const first = await window(bus, sharedLock()(), base, 'a');
    expect(first.link.control.value).toBe('CONTROLLING');
    first.host.startRound();
    first.host.drawManual(42);
    const snapshots = bus.sent.flatMap((m) => (m.t === 'snapshot' ? [m.snapshot] : []));
    const last = snapshots.at(-1);
    expect(last?.latest?.number).toBe(42);
    expect(last?.epoch).toBe(1);
    const seqs = snapshots.map((s) => s.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
  });

  it('opens further windows read-only and hands over on takeover', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bus = new LoopbackBus();
    const base = createTestPlatform();
    const makeLock = sharedLock();
    const first = await window(bus, makeLock(), base, 'a');
    const second = await window(bus, makeLock(), base, 'b');
    expect(second.link.control.value).toBe('READ_ONLY');
    expect(second.host.startRound()).toEqual({ ok: false, error: { code: 'READ_ONLY' } });
    first.host.startRound();
    first.host.drawManual(7);
    await first.app.queue.flush();
    await vi.waitFor(() => {
      expect(second.app.session.value?.game.value.rounds.get(1)?.draws).toHaveLength(1);
    });
    const takeover = second.link.takeOver();
    await vi.advanceTimersByTimeAsync(TAKEOVER_WAIT_MS);
    await takeover;
    expect(second.link.control.value).toBe('CONTROLLING');
    expect(first.link.control.value).toBe('READ_ONLY');
    expect(second.host.drawManual(8).ok).toBe(true);
    const log = second.app.session.value?.log ?? [];
    expect(log.some((entry) => entry.event.type === 'CONTROL_TAKEN_OVER')).toBe(true);
    const epochs = bus.sent.flatMap((m) => (m.t === 'snapshot' ? [m.snapshot.epoch] : []));
    expect(Math.max(...epochs)).toBe(2);
  });

  it('tracks display heartbeats and answers hello with the latest snapshot', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bus = new LoopbackBus();
    const clock = new TestClock();
    const base = createTestPlatform({ clock });
    const host = await window(bus, sharedLock()(), base, 'host');
    host.host.startRound();
    const displayApp = new AppStore({ ...base, sync: bus.transport() });
    await displayApp.boot('display');
    const display = new DisplayLink(displayApp, 'display', vi.fn());
    display.start();
    disposers.push(() => {
      display.dispose();
    });
    await vi.waitFor(() => {
      expect(display.hostConnected.value).toBe(true);
    });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(host.link.display.value).toEqual({ connected: true, synced: true });
    host.host.drawManual(3);
    expect(display.snapshot.value?.latest?.number).toBe(3);
    clock.monotonic += 10_000;
    display.dispose();
    await vi.advanceTimersByTimeAsync(1_100);
    expect(host.link.display.value.connected).toBe(false);
  });
});

describe('DisplayLink', () => {
  const snapshot = (epoch: number, seq: number): DisplaySnapshot => ({
    v: 1,
    epoch,
    seq,
    matchId: 'm',
    practice: false,
    phase: 'READY',
    totalRounds: 24,
    ring: [],
    progress: [],
    maxNumber: 90,
    drawn: [],
    theme: 'DARK',
    animation: 'NORMAL',
    performanceMode: false,
    locale: 'de-CH',
  });

  it('renders the persisted state without a host and ignores older snapshots', async () => {
    const platform = createTestPlatform();
    const seed = new AppStore(platform);
    seed.setWriteGuard(() => true);
    await seed.boot('host');
    const app = new AppStore(platform);
    await app.boot('display');
    const reload = vi.fn();
    const link = new DisplayLink(app, 'd', reload);
    link.start();
    disposers.push(() => {
      link.dispose();
    });
    expect(link.snapshot.value?.epoch).toBe(0);
    expect(link.accept(snapshot(2, 5))).toBe(true);
    expect(link.accept(snapshot(2, 4))).toBe(false);
    expect(link.accept(snapshot(1, 99))).toBe(false);
    expect(link.accept(snapshot(3, 1))).toBe(true);
    platform.sync.publish({ t: 'reload' });
    expect(reload).not.toHaveBeenCalled();
  });
});
