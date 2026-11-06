import { signal, type ReadonlySignal } from '@preact/signals';
import { cleanText } from '../domain/limits';
import type { Winner } from '../domain/types';
import type { AppStore } from './app-store';
import { nextRoundPreview, type ActivePrizeView } from './selectors';
import type { DisplayOverlay } from './sync-messages';

/** How long the Gewinn overlay stays at most; the next draw ends it earlier. */
export const WIN_OVERLAY_MS = 60_000;

/** Display overlays triggered from the host console (FR-10). */
export class OverlayController {
  private readonly current = signal<DisplayOverlay | undefined>(undefined);
  private counter = 0;
  private roundEndPending = false;
  private winTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly app: AppStore) {}

  get state(): ReadonlySignal<DisplayOverlay | undefined> {
    return this.current;
  }

  private nextId(): string {
    this.counter += 1;
    return `o${this.counter}`;
  }

  private clearTimer(): void {
    if (this.winTimer !== undefined) clearTimeout(this.winTimer);
    this.winTimer = undefined;
  }

  /** Gewinn overlay: prize and card numbers; names only when the event allows it (C6). */
  showWin(view: ActivePrizeView, title: string | undefined, winners: readonly Winner[]): void {
    const showNames = this.app.session.value?.match.value.settings.showNamesOnDisplay === true;
    this.clearTimer();
    this.current.value = {
      kind: 'WIN',
      id: this.nextId(),
      round: view.round,
      slot: view.slot,
      ...(title === undefined ? {} : { title }),
      condition: view.condition,
      winners: winners.map((w) => ({
        ...(w.cardNo === undefined ? {} : { cardNo: w.cardNo }),
        ...(showNames && w.name !== undefined ? { name: w.name } : {}),
      })),
      main: view.main,
    };
    this.winTimer = setTimeout(() => {
      this.winTimer = undefined;
      this.closeWin();
    }, WIN_OVERLAY_MS);
  }

  private closeWin(): void {
    if (this.current.value?.kind !== 'WIN') return;
    if (this.roundEndPending) this.showRoundEnd();
    else this.current.value = undefined;
  }

  /** Shows the round-end overlay after the current Gewinn overlay (or now). */
  queueRoundEnd(): void {
    this.roundEndPending = true;
    if (this.current.value?.kind !== 'WIN') this.showRoundEnd();
  }

  /** Rundenende: the next round's four prizes. */
  showRoundEnd(): void {
    const session = this.app.session.value;
    this.roundEndPending = false;
    this.clearTimer();
    if (session === undefined) return;
    const game = session.game.value;
    const preview = nextRoundPreview(game, session.catalogue.value, session.match.value.settings);
    this.current.value = {
      kind: 'ROUND_END',
      id: this.nextId(),
      round: game.currentRound ?? 1,
      ...(preview === undefined
        ? {}
        : {
            next: {
              round: preview.round,
              prizes: preview.prizes.map(({ slot, prize, condition }) => ({
                slot,
                condition,
                ...(prize === undefined ? {} : { title: prize.title }),
                ...(prize?.imageId === undefined ? {} : { imageId: prize.imageId }),
              })),
            },
          }),
    };
  }

  /** P: toggles the break screen. */
  togglePause(message: string, resumeAt?: string): void {
    if (this.current.value?.kind === 'PAUSE') {
      this.current.value = undefined;
      return;
    }
    this.showPause(message, resumeAt);
  }

  /** Pause overlay with message, optional resume time (HH:MM) and the event's sponsors. */
  showPause(message: string, resumeAt?: string): void {
    this.clearTimer();
    const sponsors = this.app.session.value?.match.value.settings.sponsors ?? [];
    const time =
      resumeAt !== undefined && /^([01]\d|2[0-3]):[0-5]\d$/.test(resumeAt) ? resumeAt : undefined;
    this.current.value = {
      kind: 'PAUSE',
      id: this.nextId(),
      message: cleanText(message).slice(0, 120),
      ...(time === undefined ? {} : { resumeAt: time }),
      sponsors: [...sponsors],
    };
  }

  /** Spielende overlay. */
  showGameEnd(name: string): void {
    this.clearTimer();
    this.roundEndPending = false;
    this.current.value = { kind: 'GAME_END', id: this.nextId(), name };
  }

  /** A new draw hides the Gewinn overlay. */
  hideTransient(): void {
    if (this.current.value?.kind === 'WIN') {
      this.clearTimer();
      this.roundEndPending = false;
      this.current.value = undefined;
    }
  }

  /** Hides any overlay. */
  hideAll(): void {
    this.clearTimer();
    this.roundEndPending = false;
    this.current.value = undefined;
  }
}
