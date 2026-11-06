import { prizeAt, snapshotOf } from '../domain/catalogue';
import * as commands from '../domain/commands';
import type { DomainError } from '../domain/errors';
import { err, ok, type Result } from '../domain/result';
import { rulesOf } from '../domain/settings';
import type { GameState } from '../domain/state';
import type { HandoutStatus, LogEnvelope, PrizeSlot, TiebreakDraw, Winner } from '../domain/types';
import { MAIN_PRIZE_SLOT } from '../domain/types';
import type { AppStore } from './app-store';
import { OverlayController } from './overlays';
import { SPIN_DURATION_MS } from './records';
import { RevealController, type Reveal } from './reveal';
import { activePrizeView } from './selectors';
import type { MatchSession } from './session';

export type ActionError =
  DomainError | { readonly code: 'READ_ONLY' } | { readonly code: 'NO_EVENT' };
export type ActionResult<T = void> = Result<T, ActionError>;
export type SpinOutcome = 'DRAWN' | 'REVEALED' | 'IGNORED';

export interface ClaimantInput {
  readonly winners: readonly Winner[];
  readonly claimants?: readonly Winner[];
  readonly tiebreak?: readonly TiebreakDraw[];
}

/** Game use cases of the host console; every change goes through the session commit pipeline. */
export class HostController {
  readonly reveal: RevealController;
  readonly overlays: OverlayController;

  constructor(private readonly app: AppStore) {
    const { platform } = app;
    this.reveal = new RevealController(platform.clock, {
      onRevealed: (reveal) => {
        this.announce(reveal);
      },
      schedule: (callback, delayMs) => {
        const id = setTimeout(callback, delayMs);
        return () => {
          clearTimeout(id);
        };
      },
    });
    this.overlays = new OverlayController(app);
  }

  private session(): Result<MatchSession, ActionError> {
    const session = this.app.session.value;
    if (session === undefined) return err({ code: 'NO_EVENT' });
    if (!this.app.canWrite()) return err({ code: 'READ_ONLY' });
    return ok(session);
  }

  private run(
    produce: (state: GameState, session: MatchSession) => commands.CommandResult,
  ): ActionResult<readonly LogEnvelope[]> {
    const session = this.session();
    if (!session.ok) return session;
    const result = produce(session.value.game.value, session.value);
    if (!result.ok) return result;
    const committed = session.value.commit(result.value);
    return committed.ok ? ok(committed.value) : err({ code: 'READ_ONLY' });
  }

  private context(session: MatchSession): commands.RoundContext {
    const { settings } = session.match.value;
    return { totalRounds: settings.rounds, rules: rulesOf(settings) };
  }

  private spinDuration(): number {
    const { animation, performanceMode } = this.app.prefs.value;
    return performanceMode ? 0 : SPIN_DURATION_MS[animation];
  }

  private announce(reveal: Reveal): void {
    const { voice, voiceDigits, sound, muted } = this.app.prefs.value;
    if (muted) return;
    if (sound) this.app.platform.sound.play('reveal');
    if (voice) this.app.platform.announcer.announce(reveal.number, voiceDigits);
  }

  private startReveal(envelopes: readonly LogEnvelope[]): void {
    const drawn = envelopes.find((e) => e.event.type === 'NUMBER_DRAWN');
    if (drawn?.event.type !== 'NUMBER_DRAWN') return;
    const { draw, round } = drawn.event;
    const duration = draw.method === 'RANDOM' ? this.spinDuration() : 0;
    this.reveal.start(`${round}-${draw.seq}-${drawn.seq}`, draw.number, draw.method, duration);
    this.overlays.hideTransient();
  }

  /** Drehen / Space: draws once; a press during the animation only reveals (FR-2). */
  spin(): ActionResult<SpinOutcome> {
    if (this.reveal.isAnimating()) {
      this.reveal.revealNow();
      return ok('REVEALED');
    }
    if (this.reveal.tooSoon()) return ok('IGNORED');
    const random = this.app.platform.random;
    const result = this.run((state) => commands.drawRandom(state, () => random.nextUint32()));
    if (!result.ok) return result;
    this.startReveal(result.value);
    return ok('DRAWN');
  }

  /** Records a number from the physical drum (FR-3). */
  drawManual(number: number): ActionResult {
    const result = this.run((state) => commands.drawManual(state, number));
    if (!result.ok) return result;
    this.startReveal(result.value);
    return ok(undefined);
  }

  /** Rückgängig: reverts the latest draw (FR-4). */
  undo(): ActionResult {
    const result = this.run((state) => commands.undoLastDraw(state));
    if (!result.ok) return result;
    this.reveal.clear();
    return ok(undefined);
  }

  /** Runde starten. */
  startRound(): ActionResult {
    const result = this.run((state, session) =>
      commands.startNextRound(state, this.context(session)),
    );
    if (!result.ok) return result;
    this.reveal.clear();
    this.overlays.hideAll();
    return ok(undefined);
  }

  /** Host override: jump to a round with a reason. */
  jumpToRound(round: number, reason: string): ActionResult {
    const result = this.run((state, session) =>
      commands.jumpToRound(state, this.context(session), round, reason),
    );
    if (!result.ok) return result;
    this.reveal.clear();
    this.overlays.hideAll();
    return ok(undefined);
  }

  /** Host override: abort the running round with a reason. */
  abortRound(reason: string): ActionResult {
    const result = this.run((state) => commands.abortRound(state, reason));
    if (!result.ok) return result;
    this.reveal.clear();
    this.overlays.hideTransient();
    return ok(undefined);
  }

  /** Host override: skip the active prize with a reason. */
  skipPrize(reason: string): ActionResult {
    const result = this.run((state) => commands.skipPrize(state, reason));
    if (!result.ok) return result;
    this.overlays.hideTransient();
    this.afterResolution();
    return ok(undefined);
  }

  /** Gewinn bestätigen: awards the active prize (FR-6, FR-7). */
  award(input: ClaimantInput): ActionResult {
    const session = this.session();
    if (!session.ok) return session;
    const { game, catalogue, match } = session.value;
    const view = activePrizeView(game.value, catalogue.value, match.value.settings);
    if (view === undefined) return err({ code: 'NO_ROUND_RUNNING' });
    const prize = snapshotOf(prizeAt(catalogue.value, view.round, view.slot), view.condition);
    const result = this.run((state) => commands.awardPrize(state, { ...input, prize }));
    if (!result.ok) return result;
    const { sound, muted } = this.app.prefs.value;
    if (sound && !muted)
      this.app.platform.sound.play(view.slot === MAIN_PRIZE_SLOT ? 'mainWin' : 'win');
    this.overlays.showWin(view, prize.title, input.winners);
    this.afterResolution();
    return ok(undefined);
  }

  /** Revokes the latest award of the current round (FR-4). */
  revokeAward(reason: string): ActionResult {
    const result = this.run((state) => commands.revokeLatestAward(state, reason));
    if (!result.ok) return result;
    this.overlays.hideAll();
    return ok(undefined);
  }

  /** Anlass abschliessen. */
  completeEvent(): ActionResult {
    const result = this.run((state) => commands.completeEvent(state));
    if (!result.ok) return result;
    const name = this.app.session.value?.match.value.settings.name ?? '';
    this.overlays.showGameEnd(name);
    return ok(undefined);
  }

  /** Corrects winner details of an earlier award (never revokes it). */
  correctWinners(
    round: number,
    slot: PrizeSlot,
    winners: readonly Winner[],
    reason: string,
  ): ActionResult {
    const result = this.run((state) =>
      commands.correctWinners(state, round, slot, winners, reason),
    );
    return result.ok ? ok(undefined) : result;
  }

  /** Gabentisch: prize handed out or open again. */
  setHandout(round: number, slot: PrizeSlot, status: HandoutStatus): ActionResult {
    const result = this.run((state) => commands.setHandout(state, round, slot, status));
    return result.ok ? ok(undefined) : result;
  }

  private afterResolution(): void {
    const game = this.app.session.value?.game.value;
    if (game?.phase === 'BETWEEN_ROUNDS') this.overlays.queueRoundEnd();
  }
}
