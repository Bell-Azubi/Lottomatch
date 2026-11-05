import type { Catalogue } from '../domain/catalogue';
import { roundRing } from '../domain/rounds';
import type { MatchSettings } from '../domain/settings';
import type { GameState } from '../domain/state';
import type { MatchKind, Preferences } from './records';
import { activePrizeView, effectiveMaxNumber, poolNumbers, prizeProgress } from './selectors';
import type { DisplayOverlay, DisplaySnapshot } from './sync-messages';

export interface RevealInfo {
  readonly key: string;
  readonly durationMs: number;
  readonly instant: boolean;
}

export interface SnapshotInput {
  readonly epoch: number;
  readonly seq: number;
  readonly matchId: string;
  readonly kind: MatchKind;
  readonly settings: MatchSettings;
  readonly catalogue: Catalogue;
  readonly game: GameState;
  readonly prefs: Preferences;
  readonly reveal: RevealInfo | undefined;
  readonly overlay: DisplayOverlay | undefined;
}

/** Builds the compact, versioned snapshot the audience display renders (FR-10). */
export function buildSnapshot(input: SnapshotInput): DisplaySnapshot {
  const { game, settings, catalogue, prefs } = input;
  const view = activePrizeView(game, catalogue, settings);
  const draws = poolNumbers(game);
  const latest = draws.at(-1);
  const prize = view?.prize;
  return {
    v: 1,
    epoch: input.epoch,
    seq: input.seq,
    matchId: input.matchId,
    practice: input.kind === 'PRACTICE',
    phase: game.phase,
    ...(game.currentRound === undefined ? {} : { round: game.currentRound }),
    totalRounds: settings.rounds,
    ring: roundRing(game, settings.rounds),
    ...(view === undefined
      ? {}
      : {
          prize: {
            slot: view.slot,
            condition: view.condition,
            ...(prize === undefined ? {} : { title: prize.title }),
            ...(prize?.description === undefined ? {} : { description: prize.description }),
            ...(prize?.valueChf === undefined ? {} : { valueChf: prize.valueChf }),
            ...(prize?.sponsor === undefined ? {} : { sponsor: prize.sponsor }),
            ...(prize?.imageId === undefined ? {} : { imageId: prize.imageId }),
          },
        }),
    progress: [...prizeProgress(game)],
    maxNumber: effectiveMaxNumber(game, settings),
    drawn: draws.map((d) => d.number),
    ...(latest === undefined
      ? {}
      : { latest: { number: latest.number, seq: latest.seq, method: latest.method } }),
    ...(input.reveal === undefined ? {} : { reveal: { ...input.reveal } }),
    ...(input.overlay === undefined ? {} : { overlay: input.overlay }),
    theme: prefs.displayTheme,
    animation: prefs.animation,
    performanceMode: prefs.performanceMode,
    locale: prefs.locale,
  };
}
