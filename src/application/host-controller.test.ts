import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestHost, TestClock, type TestHost } from '../test/test-platform';
import { MIN_DRAW_INTERVAL_MS, REVEAL_SETTLE_MS } from './reveal';
import { WIN_OVERLAY_MS } from './overlays';

let t: TestHost;
let clock: TestClock;

function game() {
  const session = t.app.session.value;
  if (session === undefined) throw new Error('no session');
  return session.game.value;
}

beforeEach(async () => {
  vi.useFakeTimers();
  clock = new TestClock();
  t = await createTestHost({ clock });
});

afterEach(() => {
  t.hostLink.dispose();
  vi.useRealTimers();
});

describe('HostController draws', () => {
  it('draws once, then a press during the animation only reveals (FR-2)', () => {
    expect(t.host.startRound().ok).toBe(true);
    expect(t.host.spin()).toEqual({ ok: true, value: 'DRAWN' });
    expect(t.host.reveal.state.value?.durationMs).toBe(1_800);
    clock.monotonic += 200;
    expect(t.host.spin()).toEqual({ ok: true, value: 'REVEALED' });
    expect(t.host.reveal.state.value?.instant).toBe(true);
    expect(game().rounds.get(1)?.draws).toHaveLength(1);
    expect(t.platform.announcer.announce).not.toHaveBeenCalled();
  });

  it('ignores a rapid second press with animation off', () => {
    t.app.setPreferences({ animation: 'OFF' });
    t.host.startRound();
    expect(t.host.spin().ok).toBe(true);
    clock.monotonic += MIN_DRAW_INTERVAL_MS - 1;
    expect(t.host.spin()).toEqual({ ok: true, value: 'IGNORED' });
    clock.monotonic += 2;
    expect(t.host.spin()).toEqual({ ok: true, value: 'DRAWN' });
    expect(game().rounds.get(1)?.draws).toHaveLength(2);
  });

  it('announces with voice and sound at reveal time when enabled', () => {
    t.app.setPreferences({ voice: true, sound: true, voiceDigits: true });
    t.host.startRound();
    t.host.spin();
    const number = game().rounds.get(1)?.draws[0]?.number;
    vi.advanceTimersByTime(1_800);
    expect(t.platform.announcer.announce).toHaveBeenCalledWith(number, true);
    expect(t.platform.sound.play).toHaveBeenCalledWith('reveal');
  });

  it('stays silent while muted', () => {
    t.app.setPreferences({ voice: true, sound: true, muted: true, animation: 'OFF' });
    t.host.startRound();
    t.host.spin();
    expect(t.platform.announcer.announce).not.toHaveBeenCalled();
  });

  it('records manual draws, rejects duplicates and undoes', () => {
    t.host.startRound();
    expect(t.host.drawManual(42).ok).toBe(true);
    expect(t.host.reveal.state.value?.durationMs).toBe(0);
    expect(t.host.drawManual(42)).toEqual({
      ok: false,
      error: { code: 'NUMBER_ALREADY_DRAWN', number: 42 },
    });
    expect(t.host.undo().ok).toBe(true);
    expect(t.host.reveal.state.value).toBeUndefined();
    expect(t.host.undo().ok).toBe(false);
  });

  it('uses no drum animation in performance mode', () => {
    t.app.setPreferences({ performanceMode: true });
    t.host.startRound();
    t.host.spin();
    expect(t.host.reveal.state.value?.durationMs).toBe(0);
    expect(t.host.reveal.isAnimating()).toBe(false);
  });

  it('stops animating after the spin and settle time', () => {
    t.host.startRound();
    t.host.spin();
    expect(t.host.reveal.isAnimating()).toBe(true);
    clock.monotonic += 1_800 + REVEAL_SETTLE_MS;
    expect(t.host.reveal.isAnimating()).toBe(false);
  });
});

describe('HostController prizes and overlays', () => {
  it('awards, shows the Gewinn overlay, then the round end after the Hauptpreis', () => {
    t.host.startRound();
    for (let slot = 1; slot <= 4; slot += 1) {
      t.host.drawManual(slot);
      expect(t.host.award({ winners: [{ cardNo: String(slot), name: 'Anna' }] }).ok).toBe(true);
      expect(t.host.overlays.state.value?.kind).toBe('WIN');
      const overlay = t.host.overlays.state.value;
      if (overlay?.kind === 'WIN') expect(overlay.winners).toEqual([{ cardNo: String(slot) }]);
      if (slot < 4) vi.advanceTimersByTime(WIN_OVERLAY_MS);
    }
    expect(t.platform.sound.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(WIN_OVERLAY_MS);
    expect(t.host.overlays.state.value?.kind).toBe('ROUND_END');
    const overlay = t.host.overlays.state.value;
    if (overlay?.kind === 'ROUND_END') expect(overlay.next?.round).toBe(2);
    expect(t.host.startRound().ok).toBe(true);
    expect(t.host.overlays.state.value).toBeUndefined();
  });

  it('shows names on the display only when the event allows it', () => {
    const session = t.app.session.value;
    if (session === undefined) throw new Error('no session');
    session.updateSettings({ ...session.match.value.settings, showNamesOnDisplay: true }, []);
    t.host.startRound();
    t.host.award({ winners: [{ cardNo: '7', name: 'Anna' }] });
    const overlay = t.host.overlays.state.value;
    expect(overlay?.kind === 'WIN' && overlay.winners).toEqual([{ cardNo: '7', name: 'Anna' }]);
  });

  it('records false claims, skips, revokes and completes', () => {
    t.host.startRound();
    t.host.drawManual(5);
    expect(t.host.rejectClaim([5, 6], [6]).ok).toBe(true);
    expect(t.host.award({ winners: [{}] }).ok).toBe(true);
    expect(t.host.revokeAward('Karte falsch').ok).toBe(true);
    expect(t.host.skipPrize('').ok).toBe(false);
    expect(t.host.skipPrize('Kein Preis').ok).toBe(true);
    expect(t.host.abortRound('Ende').ok).toBe(true);
    expect(t.host.jumpToRound(3, 'Zeit').ok).toBe(true);
    expect(game().currentRound).toBe(3);
    expect(t.host.abortRound('Ende').ok).toBe(true);
    expect(t.host.completeEvent().ok).toBe(true);
    expect(t.host.overlays.state.value?.kind).toBe('GAME_END');
  });

  it('toggles the pause overlay with sponsors from the settings', () => {
    const session = t.app.session.value;
    if (session === undefined) throw new Error('no session');
    session.updateSettings({ ...session.match.value.settings, sponsors: ['Bäckerei Muster'] }, []);
    t.host.overlays.togglePause('Pause', '21:30');
    expect(t.host.overlays.state.value).toMatchObject({
      kind: 'PAUSE',
      resumeAt: '21:30',
      sponsors: ['Bäckerei Muster'],
    });
    t.host.overlays.togglePause('Pause');
    expect(t.host.overlays.state.value).toBeUndefined();
    t.host.overlays.showPause('Pause', '25:00');
    const overlay = t.host.overlays.state.value;
    expect(overlay?.kind === 'PAUSE' && overlay.resumeAt).toBeUndefined();
  });

  it('corrects winners and handout after the award', () => {
    t.host.startRound();
    t.host.award({ winners: [{ cardNo: '1' }] });
    expect(t.host.correctWinners(1, 1, [{ cardNo: '2' }], 'Tippfehler').ok).toBe(true);
    expect(t.host.setHandout(1, 1, 'COLLECTED').ok).toBe(true);
    expect(game().rounds.get(1)?.prizes[1].award?.handout).toBe('COLLECTED');
  });

  it('refuses every action in a read-only window', async () => {
    t.app.setWriteGuard(() => false);
    expect(t.host.startRound()).toEqual({ ok: false, error: { code: 'READ_ONLY' } });
    expect(t.host.spin()).toEqual({ ok: false, error: { code: 'READ_ONLY' } });
    t.app.session.value = undefined;
    expect(t.host.drawManual(1)).toEqual({ ok: false, error: { code: 'NO_EVENT' } });
    await Promise.resolve();
  });
});
