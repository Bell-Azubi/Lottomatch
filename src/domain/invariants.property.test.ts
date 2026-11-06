import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { envelopeFor, PRIZE_RULES, RULES, sequenceSource } from '../test/domain-builders';
import {
  abortRound,
  awardPrize,
  completeEvent,
  correctWinners,
  drawManual,
  drawRandom,
  jumpToRound,
  rejectClaim,
  revokeLatestAward,
  setHandout,
  skipPrize,
  startNextRound,
  undoLastDraw,
  type CommandResult,
  type RoundContext,
} from './commands';
import { applyEnvelope, replay } from './reducer';
import {
  firstOpenSlot,
  initialGameState,
  latestResolutionLogSeq,
  latestResolvedSlot,
  poolDraws,
  runningRound,
  slotsOfRound,
  type GameState,
} from './state';
import type { LogEnvelope, PrizeSlot, RoundRules } from './types';
import { SUPERLOTTO_ROUND_SLOTS } from './types';

type Action =
  | { kind: 'start' }
  | { kind: 'jump'; round: number }
  | { kind: 'drawRandom'; value: number }
  | { kind: 'drawManual'; number: number }
  | { kind: 'undo' }
  | { kind: 'reject'; numbers: number[] }
  | { kind: 'award'; winners: number }
  | { kind: 'revoke' }
  | { kind: 'skip' }
  | { kind: 'abort' }
  | { kind: 'complete' }
  | { kind: 'correct'; round: number; slot: PrizeSlot }
  | { kind: 'handout'; round: number; slot: PrizeSlot };

const slotArb = fc.constantFrom<PrizeSlot>(1, 2, 3, 4);
const actionArb: fc.Arbitrary<Action> = fc.oneof(
  { arbitrary: fc.constant({ kind: 'start' as const }), weight: 3 },
  {
    arbitrary: fc.record({
      kind: fc.constant('jump' as const),
      round: fc.integer({ min: 0, max: 5 }),
    }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      kind: fc.constant('drawRandom' as const),
      value: fc.nat({ max: 2 ** 32 - 1 }),
    }),
    weight: 8,
  },
  {
    arbitrary: fc.record({
      kind: fc.constant('drawManual' as const),
      number: fc.integer({ min: -1, max: 92 }),
    }),
    weight: 4,
  },
  { arbitrary: fc.constant({ kind: 'undo' as const }), weight: 2 },
  {
    arbitrary: fc.record({
      kind: fc.constant('reject' as const),
      numbers: fc.uniqueArray(fc.integer({ min: 1, max: 30 }), { minLength: 1, maxLength: 5 }),
    }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      kind: fc.constant('award' as const),
      winners: fc.integer({ min: 1, max: 3 }),
    }),
    weight: 3,
  },
  { arbitrary: fc.constant({ kind: 'revoke' as const }), weight: 2 },
  { arbitrary: fc.constant({ kind: 'skip' as const }), weight: 1 },
  { arbitrary: fc.constant({ kind: 'abort' as const }), weight: 1 },
  { arbitrary: fc.constant({ kind: 'complete' as const }), weight: 1 },
  {
    arbitrary: fc.record({
      kind: fc.constant('correct' as const),
      round: fc.integer({ min: 1, max: 4 }),
      slot: slotArb,
    }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      kind: fc.constant('handout' as const),
      round: fc.integer({ min: 1, max: 4 }),
      slot: slotArb,
    }),
    weight: 1,
  },
);

function execute(state: GameState, action: Action, context: RoundContext): CommandResult {
  switch (action.kind) {
    case 'start':
      return startNextRound(state, context);
    case 'jump':
      return jumpToRound(state, context, action.round, 'Sprung');
    case 'drawRandom':
      return drawRandom(state, sequenceSource([action.value, 0]));
    case 'drawManual':
      return drawManual(state, action.number);
    case 'undo':
      return undoLastDraw(state);
    case 'reject':
      return rejectClaim(state, action.numbers, action.numbers);
    case 'award':
      return awardPrize(state, {
        winners: Array.from({ length: action.winners }, (_, i) => ({
          cardNo: String(i + 1),
          name: 'N',
        })),
        prize: { winCondition: { kind: 'ONE_LINE' } },
      });
    case 'revoke':
      return revokeLatestAward(state, 'Fehler');
    case 'skip':
      return skipPrize(state, 'leer');
    case 'abort':
      return abortRound(state, 'Abbruch');
    case 'complete':
      return completeEvent(state);
    case 'correct':
      return correctWinners(state, action.round, action.slot, [{ cardNo: '9' }], 'Korrektur');
    case 'handout':
      return setHandout(state, action.round, action.slot, 'COLLECTED');
  }
}

function assertInvariants(
  state: GameState,
  log: readonly LogEnvelope[],
  rulesAtStart: Map<number, RoundRules>,
): void {
  let running = 0;
  for (const round of state.rounds.values()) {
    const max = round.rules?.maxNumber ?? 99;
    for (const slot of SUPERLOTTO_ROUND_SLOTS) {
      const numbers = poolDraws(round, slot).map((d) => d.number);
      // I1: unique integers in 1..N per pool.
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= max)).toBe(true);
    }
    // I2: resolved prizes form a prefix in slot order.
    const statuses = slotsOfRound(round).map((slot) => round.prizes[slot].status);
    const firstOpen = statuses.indexOf('OPEN');
    if (firstOpen >= 0) expect(statuses.slice(firstOpen).every((s) => s === 'OPEN')).toBe(true);
    // A completed round has resolved every prize it plays, the Superlotto included.
    if (round.status === 'COMPLETED') expect(firstOpen).toBe(-1);
    if (round.status === 'RUNNING') {
      running += 1;
      expect(firstOpenSlot(round)).toBeDefined();
      // I6: rules of a running round never change during the run.
      expect(round.rules).toEqual(rulesAtStart.get(round.round));
    }
  }
  // I5: at most one running round, consistent with the phase.
  expect(running).toBe(state.phase === 'ROUND_RUNNING' ? 1 : 0);
  // I7: strictly increasing sequence; replay reproduces the state.
  log.forEach((envelope, index) => expect(envelope.seq).toBe(index + 1));
  const replayed = replay(log);
  expect(replayed.ok && replayed.value).toEqual(state);
}

function checkUndoRule(before: GameState, action: Action, result: CommandResult): void {
  if (action.kind !== 'undo') return;
  const round = runningRound(before);
  const last = round?.draws.at(-1);
  // I3: undo succeeds exactly when the latest draw was not followed by an award or skip.
  const allowed =
    round !== undefined && last !== undefined && last.logSeq > latestResolutionLogSeq(round);
  expect(result.ok).toBe(allowed);
}

function checkRevokeRule(before: GameState, action: Action, result: CommandResult): void {
  if (action.kind !== 'revoke' || !result.ok || before.currentRound === undefined) return;
  // I4: only the latest award of the current round can be revoked.
  const round = before.rounds.get(before.currentRound);
  const slot = round === undefined ? undefined : latestResolvedSlot(round);
  expect(slot !== undefined && round?.prizes[slot].status === 'AWARDED').toBe(true);
}

describe('invariants I1–I7 under arbitrary command sequences', () => {
  it('hold for every reachable state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(RULES, PRIZE_RULES, {
          maxNumber: 30,
          perLine: 3,
          lines: 2,
          boardReset: 'ROUND' as const,
        }),
        fc.array(actionArb, { maxLength: 160 }),
        (rules, actions) => {
          const context: RoundContext = { totalRounds: 4, rules, superlottoRounds: new Set([2]) };
          let state = initialGameState();
          const log: LogEnvelope[] = [];
          const rulesAtStart = new Map<number, RoundRules>();
          for (const action of actions) {
            const result = execute(state, action, context);
            checkUndoRule(state, action, result);
            checkRevokeRule(state, action, result);
            if (!result.ok) continue;
            for (const event of result.value) {
              const envelope = envelopeFor(state, event);
              log.push(envelope);
              state = applyEnvelope(state, envelope);
              if (event.type === 'ROUND_STARTED') rulesAtStart.set(event.round, event.rules);
            }
            assertInvariants(state, log, rulesAtStart);
          }
        },
      ),
      { numRuns: 250 },
    );
  });
});
