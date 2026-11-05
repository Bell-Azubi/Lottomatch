import { signal, type ReadonlySignal } from '@preact/signals';
import type { DrawMethod } from '../domain/types';
import type { Clock } from './ports';
import type { RevealInfo } from './snapshot';

/** Time after the drum phase in which the badge assembles and flies into the board. */
export const REVEAL_SETTLE_MS = 750;
/** Presses closer together than this never draw twice (rapid double press). */
export const MIN_DRAW_INTERVAL_MS = 400;

export interface Reveal extends RevealInfo {
  readonly number: number;
  readonly method: DrawMethod;
  readonly startedAt: number;
}

export interface RevealHooks {
  /** Called once when the number becomes visible to the audience. */
  readonly onRevealed: (reveal: Reveal) => void;
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
}

/**
 * Cosmetic reveal of a committed draw (FR-2). The result is fixed before the animation starts;
 * a second press only reveals it at once.
 */
export class RevealController {
  private readonly current = signal<Reveal | undefined>(undefined);
  private cancelTimer: () => void = () => undefined;
  private lastDrawAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly clock: Clock,
    private readonly hooks: RevealHooks,
  ) {}

  get state(): ReadonlySignal<Reveal | undefined> {
    return this.current;
  }

  /** True while a press must reveal instead of drawing again. */
  isAnimating(): boolean {
    const reveal = this.current.value;
    if (reveal === undefined || reveal.instant || reveal.durationMs === 0) return false;
    return this.clock.nowMs() < reveal.startedAt + reveal.durationMs + REVEAL_SETTLE_MS;
  }

  /** True when a new draw would follow the previous one too closely. */
  tooSoon(): boolean {
    return this.clock.nowMs() - this.lastDrawAt < MIN_DRAW_INTERVAL_MS;
  }

  /** Starts the reveal of a committed draw. */
  start(key: string, number: number, method: DrawMethod, durationMs: number): void {
    this.cancelTimer();
    const now = this.clock.nowMs();
    this.lastDrawAt = now;
    const reveal: Reveal = { key, number, method, durationMs, startedAt: now, instant: false };
    this.current.value = reveal;
    if (durationMs === 0) {
      this.hooks.onRevealed(reveal);
      return;
    }
    this.cancelTimer = this.hooks.schedule(() => {
      if (this.current.value?.key === key) this.hooks.onRevealed(reveal);
    }, durationMs);
  }

  /** Second press during the spin: reveal at once, never draw again. */
  revealNow(): void {
    const reveal = this.current.value;
    if (reveal === undefined || reveal.instant) return;
    this.cancelTimer();
    const instant = { ...reveal, instant: true };
    this.current.value = instant;
    if (this.clock.nowMs() < reveal.startedAt + reveal.durationMs) this.hooks.onRevealed(instant);
  }

  /** Clears the reveal (undo, new round). */
  clear(): void {
    this.cancelTimer();
    this.current.value = undefined;
  }
}
