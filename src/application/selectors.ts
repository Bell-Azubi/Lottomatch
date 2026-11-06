import { conditionFor, prizeAt, type Catalogue } from '../domain/catalogue';
import type { MatchSettings } from '../domain/settings';
import { activePool, firstOpenSlot, roundOf, runningRound, type GameState } from '../domain/state';
import type { DrawEntry } from '../domain/state';
import type { Prize, PrizeSlot, WinCondition } from '../domain/types';
import { MAIN_PRIZE_SLOT, PRIZE_SLOTS } from '../domain/types';
import { nextRound } from '../domain/rounds';
import type { PrizeProgress } from './sync-messages';

/** The prize currently played for, as shown on host and display (FR-5). */
export interface ActivePrizeView {
  readonly round: number;
  readonly slot: PrizeSlot;
  readonly prize: Prize | undefined;
  readonly condition: WinCondition;
  readonly main: boolean;
}

export function activePrizeView(
  state: GameState,
  catalogue: Catalogue,
  settings: MatchSettings,
): ActivePrizeView | undefined {
  const pool = activePool(state);
  if (pool === undefined) return undefined;
  const condition = conditionFor(catalogue, settings.template, pool.round.round, pool.slot);
  return {
    round: pool.round.round,
    slot: pool.slot,
    prize: prizeAt(catalogue, pool.round.round, pool.slot),
    condition,
    main: pool.slot === MAIN_PRIZE_SLOT,
  };
}

/** Progress of the four prizes of the current (or last) round. */
export function prizeProgress(state: GameState): readonly PrizeProgress[] {
  if (state.currentRound === undefined) return PRIZE_SLOTS.map(() => 'UPCOMING');
  const round = roundOf(state, state.currentRound);
  const active = state.phase === 'ROUND_RUNNING' ? firstOpenSlot(round) : undefined;
  return PRIZE_SLOTS.map((slot) => {
    const { status } = round.prizes[slot];
    if (status === 'AWARDED') return 'AWARDED';
    if (status === 'SKIPPED') return 'SKIPPED';
    return slot === active ? 'ACTIVE' : 'UPCOMING';
  });
}

/** Draws of the active pool; empty between rounds. */
export function poolNumbers(state: GameState): readonly DrawEntry[] {
  return activePool(state)?.draws ?? [];
}

/** The latest draw of the active pool. */
export function latestDraw(state: GameState): DrawEntry | undefined {
  return poolNumbers(state).at(-1);
}

/** The last `count` numbers, newest first. */
export function lastNumbers(state: GameState, count = 5): readonly number[] {
  return poolNumbers(state)
    .slice(-count)
    .map((d) => d.number)
    .reverse();
}

/** Maximum number of the running round, else of the settings (N can only change between rounds). */
export function effectiveMaxNumber(state: GameState, settings: MatchSettings): number {
  return runningRound(state)?.rules?.maxNumber ?? settings.maxNumber;
}

/** True when the card already won another prize earlier in the round (FR-6 hint). */
export function cardWonEarlier(state: GameState, round: number, cardNo: string): boolean {
  const wanted = cardNo.trim();
  if (wanted === '') return false;
  const { prizes } = roundOf(state, round);
  return PRIZE_SLOTS.some(
    (slot) => prizes[slot].award?.winners.some((w) => w.cardNo === wanted) === true,
  );
}

export interface RoundPreview {
  readonly round: number;
  readonly prizes: readonly {
    readonly slot: PrizeSlot;
    readonly prize: Prize | undefined;
    readonly condition: WinCondition;
  }[];
}

/** The round "Runde starten" would begin, with its four prizes. */
export function nextRoundPreview(
  state: GameState,
  catalogue: Catalogue,
  settings: MatchSettings,
): RoundPreview | undefined {
  const round = nextRound(state, settings.rounds);
  if (round === undefined) return undefined;
  return {
    round,
    prizes: PRIZE_SLOTS.map((slot) => ({
      slot,
      prize: prizeAt(catalogue, round, slot),
      condition: conditionFor(catalogue, settings.template, round, slot),
    })),
  };
}

/** True when the prize at (round, slot) is awarded and therefore read-only. */
export function isAwarded(state: GameState, round: number, slot: PrizeSlot): boolean {
  return roundOf(state, round).prizes[slot].status === 'AWARDED';
}
