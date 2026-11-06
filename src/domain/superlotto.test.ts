import { describe, expect, it } from 'vitest';
import { apply, CONTEXT, drawAll, RULES, run, startedState } from '../test/domain-builders';
import {
  applyTemplate,
  clearRound,
  conditionFor,
  copyRound,
  EMPTY_CATALOGUE,
  findGaps,
  plannedSlots,
  prizeAt,
  superlottoRounds,
  upsertPrize,
  type Catalogue,
} from './catalogue';
import { checkEvent } from './check';
import {
  awardPrize,
  drawManual,
  jumpToRound,
  revokeLatestAward,
  skipPrize,
  startNextRound,
} from './commands';
import { DEFAULT_TEMPLATE } from './settings';
import {
  activePool,
  activeSlot,
  hasResolution,
  initialGameState,
  latestResolvedSlot,
  roundOf,
  slotsOfRound,
  type GameState,
} from './state';
import type { Prize, PrizeSlot, PrizeSnapshot, RoundRules } from './types';

const SUPERLOTTO: RoundRules = { ...RULES, superlotto: true };
const PRIZE: PrizeSnapshot = { title: 'Grosser Früchtekorb', winCondition: { kind: 'FULL_CARD' } };

const award = (state: GameState): GameState =>
  run(state, awardPrize(state, { winners: [{ cardNo: '17' }], prize: PRIZE }));

/** Awards the first `count` prizes, drawing one new number for each. */
function awardMany(start: GameState, count: number): GameState {
  let state = start;
  for (let index = 0; index < count; index += 1) {
    state = award(drawAll(state, [index + 1]));
  }
  return state;
}

const prize = (round: number, slot: PrizeSlot, extra: Partial<Prize> = {}): Prize => ({
  id: `p${round}-${slot}`,
  round,
  slot,
  title: `Runde ${round}, Preis ${slot}`,
  winCondition: { kind: 'CUSTOM', label: 'Eigene' },
  ...extra,
});

const catalogueOf = (...prizes: readonly Prize[]): Catalogue =>
  prizes.reduce(upsertPrize, EMPTY_CATALOGUE);

const NOT_LOCKED = () => false;
const newId = () => 'new';

describe('a round with and without a Superlotto (ADR-0027)', () => {
  it('ends after the four prizes when it has none', () => {
    const state = awardMany(startedState(), 4);
    expect(roundOf(state, 1).status).toBe('COMPLETED');
    expect(state.phase).toBe('BETWEEN_ROUNDS');
    expect(slotsOfRound(roundOf(state, 1))).toEqual([1, 2, 3, 4]);
    expect(latestResolvedSlot(roundOf(state, 1))).toBe(4);
  });

  it('plays the Superlotto after the fourth prize, then ends', () => {
    let state = awardMany(startedState(SUPERLOTTO), 4);
    expect(roundOf(state, 1).status).toBe('RUNNING');
    expect(activeSlot(state)).toBe(5);
    expect(slotsOfRound(roundOf(state, 1))).toEqual([1, 2, 3, 4, 5]);
    state = award(drawAll(state, [50]));
    expect(roundOf(state, 1).status).toBe('COMPLETED');
    expect(roundOf(state, 1).prizes[5].award?.prize.title).toBe('Grosser Früchtekorb');
    expect(latestResolvedSlot(roundOf(state, 1))).toBe(5);
  });

  it('completes the round when the Superlotto is skipped', () => {
    const state = awardMany(startedState(SUPERLOTTO), 4);
    const skipped = run(state, skipPrize(state, 'Kein Preis da'));
    expect(roundOf(skipped, 1).status).toBe('COMPLETED');
    expect(roundOf(skipped, 1).prizes[5].status).toBe('SKIPPED');
  });

  it('refuses a fifth prize in a round without a Superlotto', () => {
    const state = awardMany(startedState(), 3);
    const event = {
      type: 'PRIZE_AWARDED',
      round: 1,
      slot: 5,
      winners: [{}],
      prize: PRIZE,
    } as const;
    const check = checkEvent(state, event);
    expect(check.ok ? undefined : check.error.code).toBe('SLOT_MISMATCH');
  });

  it('reopens the Superlotto when its award is revoked', () => {
    const state = award(drawAll(awardMany(startedState(SUPERLOTTO), 4), [50]));
    const reopened = run(state, revokeLatestAward(state, 'Karte falsch gelesen'));
    expect(reopened.phase).toBe('ROUND_RUNNING');
    expect(activeSlot(reopened)).toBe(5);
    expect(hasResolution(roundOf(reopened, 1))).toBe(true);
  });
});

describe('freezing the Superlotto at the round start', () => {
  const context = { ...CONTEXT, superlottoRounds: new Set([2]) };

  it('gives only the selected rounds a Superlotto', () => {
    const first = run(initialGameState(), startNextRound(initialGameState(), context));
    expect(roundOf(first, 1).rules).toEqual(RULES);
    const second = run(first, jumpToRound(first, context, 2, 'Runde vorgezogen'));
    expect(roundOf(second, 2).rules).toEqual(SUPERLOTTO);
  });

  it('reads a logged round without the field as four prizes', () => {
    const state = apply(initialGameState(), [
      { type: 'ROUND_STARTED', round: 1, rules: { ...RULES } },
    ]);
    expect(slotsOfRound(roundOf(state, 1))).toEqual([1, 2, 3, 4]);
  });
});

describe('the Superlotto never clears the board', () => {
  it('keeps the numbers of the round', () => {
    const state = awardMany(startedState(SUPERLOTTO), 4);
    expect(activePool(state)?.draws.map((draw) => draw.number)).toEqual([1, 2, 3, 4]);
  });

  it('goes on with the numbers of the fourth prize even when the board resets per prize', () => {
    const rules: RoundRules = { ...SUPERLOTTO, boardReset: 'PRIZE' };
    let state = awardMany(startedState(rules), 3);
    expect(activePool(state)?.draws).toEqual([]);
    state = award(drawAll(state, [10, 11]));
    expect(activePool(state)?.slot).toBe(5);
    expect(activePool(state)?.draws.map((draw) => draw.number)).toEqual([10, 11]);
    const again = drawManual(state, 10);
    expect(again.ok ? undefined : again.error.code).toBe('NUMBER_ALREADY_DRAWN');
    state = drawAll(state, [1]);
    expect(activePool(state)?.draws.map((draw) => draw.number)).toEqual([10, 11, 1]);
  });

  it('blocks revoking the fourth prize once the Superlotto has its own draws', () => {
    const rules: RoundRules = { ...SUPERLOTTO, boardReset: 'PRIZE' };
    const state = drawAll(awardMany(startedState(rules), 4), [50]);
    const result = revokeLatestAward(state, 'Karte falsch gelesen');
    expect(result.ok ? undefined : result.error.code).toBe('REVOKE_BLOCKED_BY_DRAWS');
  });
});

describe('the Superlotto in the catalogue', () => {
  const superlotto = prize(4, 5, { title: 'Grosser Früchtekorb' });

  it('plans five prizes only where a Superlotto is entered', () => {
    const catalogue = catalogueOf(superlotto, prize(1, 1));
    expect(plannedSlots(catalogue, 4)).toEqual([1, 2, 3, 4, 5]);
    expect(plannedSlots(catalogue, 1)).toEqual([1, 2, 3, 4]);
    expect([...superlottoRounds(catalogue)]).toEqual([4]);
  });

  it('is played for a full card while the four prizes need one row', () => {
    const own = catalogueOf(superlotto);
    for (const slot of [1, 2, 3, 4] as const) {
      expect(conditionFor(EMPTY_CATALOGUE, DEFAULT_TEMPLATE, 4, slot)).toEqual({
        kind: 'ONE_LINE',
      });
    }
    expect(conditionFor(EMPTY_CATALOGUE, DEFAULT_TEMPLATE, 4, 5)).toEqual({ kind: 'FULL_CARD' });
    expect(conditionFor(own, DEFAULT_TEMPLATE, 4, 5)).toEqual({ kind: 'CUSTOM', label: 'Eigene' });
  });

  it('never counts as a gap: a round needs no Superlotto', () => {
    const complete = catalogueOf(prize(1, 1), prize(1, 2), prize(1, 3), prize(1, 4));
    expect(findGaps(complete, 1)).toEqual([]);
    expect(findGaps(catalogueOf(superlotto), 4).at(-1)).toEqual({
      round: 4,
      slots: [1, 2, 3, 4],
    });
  });

  it('stays where it is when a round is copied', () => {
    const source = catalogueOf(prize(1, 1), prize(1, 5), superlotto);
    const { catalogue } = copyRound(source, 1, [2, 4], NOT_LOCKED, newId);
    expect(prizeAt(catalogue, 2, 1)?.title).toBe('Runde 1, Preis 1');
    expect(prizeAt(catalogue, 2, 5)).toBeUndefined();
    expect(prizeAt(catalogue, 4, 5)?.title).toBe('Grosser Früchtekorb');
  });

  it('keeps its rule when the template is applied', () => {
    const { catalogue, skipped } = applyTemplate(
      catalogueOf(prize(4, 1), superlotto),
      DEFAULT_TEMPLATE,
      NOT_LOCKED,
    );
    expect(prizeAt(catalogue, 4, 1)?.winCondition).toEqual({ kind: 'ONE_LINE' });
    expect(prizeAt(catalogue, 4, 5)?.winCondition).toEqual({ kind: 'CUSTOM', label: 'Eigene' });
    expect(skipped).toEqual([]);
  });

  it('is removed when its round is cleared, unless it is awarded', () => {
    const source = catalogueOf(prize(4, 1), superlotto);
    expect(clearRound(source, 4, NOT_LOCKED).catalogue.prizes).toEqual([]);
    const locked = clearRound(source, 4, (_round, slot) => slot === 5);
    expect(locked.skipped).toEqual([{ round: 4, slot: 5 }]);
    expect(prizeAt(locked.catalogue, 4, 5)?.title).toBe('Grosser Früchtekorb');
  });
});
