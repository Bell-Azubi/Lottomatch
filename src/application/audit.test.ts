import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../domain/types';
import { buildLog, EVENING } from '../test/results-fixture';
import { auditEntries, auditRounds, categoryOf, filterAudit } from './audit';

describe('categoryOf', () => {
  const rules = { maxNumber: 90, perLine: 5, lines: 3, boardReset: 'ROUND' } as const;
  it.each<[LogEvent, string]>([
    [{ type: 'ROUND_STARTED', round: 1, rules }, 'DRAWS'],
    [{ type: 'ROUND_STARTED', round: 3, rules, reason: 'Sprung' }, 'OVERRIDES'],
    [{ type: 'NUMBER_DRAWN', round: 1, draw: { seq: 1, number: 4, method: 'RANDOM' } }, 'DRAWS'],
    [{ type: 'DRAW_UNDONE', round: 1, seq: 1 }, 'CORRECTIONS'],
    [{ type: 'CLAIM_REJECTED', round: 1, slot: 1, claimed: [1], missing: [1] }, 'CLAIMS'],
    [
      {
        type: 'PRIZE_AWARDED',
        round: 1,
        slot: 1,
        winners: [{}],
        prize: { winCondition: { kind: 'ONE_LINE' } },
      },
      'CLAIMS',
    ],
    [{ type: 'HANDOUT_CHANGED', round: 1, slot: 1, status: 'COLLECTED' }, 'CLAIMS'],
    [{ type: 'AWARD_REVOKED', round: 1, slot: 1, reason: 'x' }, 'CORRECTIONS'],
    [{ type: 'WINNER_CORRECTED', round: 1, slot: 1, winners: [{}], reason: '' }, 'CORRECTIONS'],
    [{ type: 'PRIZE_SKIPPED', round: 1, slot: 1, reason: 'x' }, 'OVERRIDES'],
    [{ type: 'ROUND_ABORTED', round: 1, reason: 'x' }, 'OVERRIDES'],
    [{ type: 'EVENT_COMPLETED' }, 'OVERRIDES'],
    [{ type: 'SETTINGS_CHANGED', changes: [] }, 'DOCUMENTS'],
    [{ type: 'PRIZES_CHANGED', action: 'x', rounds: [] }, 'DOCUMENTS'],
    [{ type: 'PIN_RESET' }, 'SYSTEM'],
    [{ type: 'PERSONAL_DATA_ERASED', winners: 0 }, 'SYSTEM'],
    [{ type: 'CONTROL_TAKEN_OVER' }, 'SYSTEM'],
  ])('puts %o into %s', (event, category) => {
    expect(categoryOf(event)).toBe(category);
  });
});

describe('auditEntries', () => {
  const entries = auditEntries(buildLog(EVENING));

  it('keeps log order, positions, times and rounds', () => {
    expect(entries.map((entry) => entry.seq)).toEqual(EVENING.map((_, index) => index + 1));
    expect(entries[0]).toMatchObject({
      seq: 1,
      at: '2026-11-07T17:00:00.000Z',
      round: 1,
      category: 'DRAWS',
    });
    expect(entries.at(-1)).toMatchObject({ round: undefined, category: 'SYSTEM' });
  });

  it('recovers the undone number and the winners of a revoked award', () => {
    const undone = entries.find((entry) => entry.event.type === 'DRAW_UNDONE');
    expect(undone?.undoneNumber).toBe(77);
    const revoked = entries.find((entry) => entry.event.type === 'AWARD_REVOKED');
    expect(revoked?.revokedWinners).toEqual([{ cardNo: '30' }]);
    expect(entries.every((entry) => entry === undone || entry.undoneNumber === undefined)).toBe(
      true,
    );
  });

  it('tolerates draws without a preceding round start', () => {
    const [entry] = auditEntries(
      buildLog([{ type: 'NUMBER_DRAWN', round: 2, draw: { seq: 1, number: 9, method: 'MANUAL' } }]),
    );
    expect(entry?.category).toBe('DRAWS');
    const [undo] = auditEntries(buildLog([{ type: 'DRAW_UNDONE', round: 4, seq: 1 }]));
    expect(undo?.undoneNumber).toBeUndefined();
  });

  it('filters by category and round, newest first', () => {
    const draws = filterAudit(entries, { category: 'DRAWS', round: 1 });
    expect(draws[0]?.seq).toBeGreaterThan(draws.at(-1)?.seq ?? 0);
    expect(draws.every((entry) => entry.category === 'DRAWS' && entry.round === 1)).toBe(true);
    expect(filterAudit(entries, { category: 'ALL', round: 'ALL' })).toHaveLength(EVENING.length);
    expect(filterAudit(entries, { category: 'SYSTEM', round: 'ALL' })).toHaveLength(3);
    expect(
      filterAudit(entries, { category: 'ALL', round: 2 }).map((entry) => entry.event.type),
    ).toEqual(['ROUND_ABORTED', 'NUMBER_DRAWN', 'ROUND_STARTED']);
  });

  it('lists the rounds that occur in the log', () => {
    expect(auditRounds(entries)).toEqual([1, 2]);
    expect(auditRounds([])).toEqual([]);
  });
});
