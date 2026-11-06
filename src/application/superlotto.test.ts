import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOGUE, upsertPrize } from '../domain/catalogue';
import { abortRound, awardPrize, type CommandResult } from '../domain/commands';
import { replay } from '../domain/reducer';
import { defaultSettings } from '../domain/settings';
import { initialGameState, roundOf, type GameState } from '../domain/state';
import type { Prize, RoundRules } from '../domain/types';
import { apply, drawAll, logOf, RULES, run, startedState } from '../test/domain-builders';
import { computeResults } from './results';
import { logEventSchema } from './schemas';
import {
  activePrizeView,
  cardWonEarlier,
  isSlotLocked,
  nextRoundPreview,
  prizeProgress,
  slotsForRound,
} from './selectors';
import { snapshotSchema } from './sync-messages';

const SETTINGS = defaultSettings('Lottomatch');
const SUPERLOTTO: RoundRules = { ...RULES, superlotto: true };
const prize: Prize = {
  id: 's',
  round: 1,
  slot: 5,
  title: 'Grosser Früchtekorb',
  winCondition: { kind: 'FULL_CARD' },
};
const catalogue = upsertPrize(EMPTY_CATALOGUE, prize);

const SNAPSHOT = { winCondition: { kind: 'ONE_LINE' } } as const;
const award = (state: GameState, cardNo: string): GameState => {
  const result: CommandResult = awardPrize(state, { winners: [{ cardNo }], prize: SNAPSHOT });
  return run(state, result);
};

function awardMany(start: GameState, count: number): GameState {
  let state = start;
  for (let index = 0; index < count; index += 1) {
    state = award(drawAll(state, [index + 1]), String(index + 1));
  }
  return state;
}

describe('prizes of a round on host and display', () => {
  it('shows five prizes in a Superlotto round and four otherwise', () => {
    expect(prizeProgress(startedState())).toHaveLength(4);
    expect(prizeProgress(startedState(SUPERLOTTO))).toEqual([
      'ACTIVE',
      'UPCOMING',
      'UPCOMING',
      'UPCOMING',
      'UPCOMING',
    ]);
    expect(prizeProgress(awardMany(startedState(SUPERLOTTO), 4))).toEqual([
      'AWARDED',
      'AWARDED',
      'AWARDED',
      'AWARDED',
      'ACTIVE',
    ]);
  });

  it('highlights only the Superlotto', () => {
    const state = awardMany(startedState(SUPERLOTTO), 3);
    expect(activePrizeView(state, catalogue, SETTINGS)).toMatchObject({
      slot: 4,
      superlotto: false,
      condition: { kind: 'ONE_LINE' },
    });
    const last = award(drawAll(state, [50]), '4');
    expect(activePrizeView(last, catalogue, SETTINGS)).toMatchObject({
      slot: 5,
      superlotto: true,
      condition: { kind: 'FULL_CARD' },
      prize: { title: 'Grosser Früchtekorb' },
    });
  });

  it('previews the Superlotto of the next round', () => {
    const next = nextRoundPreview(initialGameState(), catalogue, SETTINGS);
    expect(next?.prizes.map((entry) => entry.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(next?.prizes.at(-1)?.prize?.title).toBe('Grosser Früchtekorb');
    const plain = nextRoundPreview(initialGameState(), EMPTY_CATALOGUE, SETTINGS);
    expect(plain?.prizes.map((entry) => entry.slot)).toEqual([1, 2, 3, 4]);
  });

  it('finds a card that won the Superlotto', () => {
    const state = award(drawAll(awardMany(startedState(SUPERLOTTO), 4), [50]), '77');
    expect(cardWonEarlier(state, 1, '77')).toBe(true);
    expect(cardWonEarlier(state, 1, '78')).toBe(false);
  });

  it('lists the prizes a round plays, and a Superlotto entered for a later run', () => {
    const upcoming = roundOf(initialGameState(), 1);
    expect(slotsForRound(upcoming, catalogue)).toHaveLength(5);
    expect(slotsForRound(upcoming, EMPTY_CATALOGUE)).toHaveLength(4);
    const frozen = roundOf(startedState(SUPERLOTTO), 1);
    expect(slotsForRound(frozen, EMPTY_CATALOGUE)).toHaveLength(5);
  });
});

describe('when a Superlotto can still join a round', () => {
  it('allows it before the start, and in a round that has one', () => {
    expect(isSlotLocked(initialGameState(), 1, 5)).toBe(false);
    expect(isSlotLocked(startedState(SUPERLOTTO), 1, 5)).toBe(false);
  });

  it('closes it once the round started without one, also after the round ended', () => {
    const running = startedState();
    expect(isSlotLocked(running, 1, 5)).toBe(true);
    expect(isSlotLocked(running, 1, 2)).toBe(false);
    expect(isSlotLocked(awardMany(running, 4), 1, 5)).toBe(true);
    expect(isSlotLocked(running, 2, 5)).toBe(false);
  });

  it('opens it again when the round was aborted and can be started anew', () => {
    const drawn = drawAll(startedState(), [7]);
    const aborted = run(drawn, abortRound(drawn, 'Fehlstart'));
    expect(isSlotLocked(aborted, 1, 5)).toBe(false);
  });

  it('locks an awarded Superlotto', () => {
    const state = award(drawAll(awardMany(startedState(SUPERLOTTO), 4), [50]), '77');
    expect(isSlotLocked(awardMany(startedState(SUPERLOTTO), 4), 1, 5)).toBe(false);
    expect(isSlotLocked(state, 1, 5)).toBe(true);
  });
});

describe('results with a Superlotto', () => {
  it('reports it as a fifth prize of its round', () => {
    const events = [
      { type: 'ROUND_STARTED', round: 1, rules: SUPERLOTTO },
      ...(['1', '2', '3', '4', '5'] as const).flatMap((text, index) => [
        {
          type: 'NUMBER_DRAWN',
          round: 1,
          draw: { seq: index + 1, number: index + 1, method: 'MANUAL' },
        } as const,
        {
          type: 'PRIZE_AWARDED',
          round: 1,
          slot: (index + 1) as 1 | 2 | 3 | 4 | 5,
          winners: [{ cardNo: text }],
          prize: { title: `Preis ${text}`, winCondition: { kind: 'FULL_CARD' }, valueChf: 10 },
        } as const,
      ]),
    ] as const;
    const log = logOf(events);
    const game = apply(initialGameState(), events);
    expect(replay(log).ok).toBe(true);
    const { rounds, totals } = computeResults({ game, log, catalogue, settings: SETTINGS });
    expect(rounds[0]?.status).toBe('COMPLETED');
    expect(rounds[0]?.prizes.map((entry) => entry.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(rounds[1]?.prizes).toHaveLength(4);
    expect(totals.prizesAwarded).toBe(5);
    expect(totals.valueAwardedChf).toBe(50);
  });

  it('shows the planned Superlotto of a round that has not started', () => {
    const planned = upsertPrize(EMPTY_CATALOGUE, { ...prize, round: 3 });
    const { rounds } = computeResults({
      game: initialGameState(),
      log: [],
      catalogue: planned,
      settings: SETTINGS,
    });
    expect(rounds[2]?.prizes.at(-1)).toMatchObject({
      slot: 5,
      status: 'OPEN',
      title: 'Grosser Früchtekorb',
    });
    expect(rounds[3]?.prizes).toHaveLength(4);
  });
});

describe('trust boundaries', () => {
  const started = (rules: unknown) =>
    v.safeParse(logEventSchema, { type: 'ROUND_STARTED', round: 1, rules });

  it('accepts logs with and without the field and keeps it', () => {
    expect(started(RULES).success).toBe(true);
    const parsed = started(SUPERLOTTO);
    expect(parsed.success && parsed.output).toMatchObject({ rules: { superlotto: true } });
  });

  it('refuses anything but true, and unknown slots', () => {
    expect(started({ ...RULES, superlotto: false }).success).toBe(false);
    const skip = { type: 'PRIZE_SKIPPED', round: 1, reason: 'x' };
    expect(v.safeParse(logEventSchema, { ...skip, slot: 5 }).success).toBe(true);
    expect(v.safeParse(logEventSchema, { ...skip, slot: 6 }).success).toBe(false);
  });

  it('lets five prizes through to the display, but not six', () => {
    const { progress } = snapshotSchema.entries;
    expect(
      v.safeParse(
        progress,
        Array.from({ length: 5 }, () => 'UPCOMING'),
      ).success,
    ).toBe(true);
    expect(
      v.safeParse(
        progress,
        Array.from({ length: 6 }, () => 'UPCOMING'),
      ).success,
    ).toBe(false);
  });
});
