import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOGUE, upsertPrize } from '../domain/catalogue';
import { replay } from '../domain/reducer';
import { initialGameState } from '../domain/state';
import { buildLog, evening, SETTINGS } from '../test/results-fixture';
import { computeResults, type EventResults, type RoundSummary } from './results';
import { filterRounds, resultsDocument, RESULTS_FORMAT, winnerRows } from './results-output';

const catalogue = upsertPrize(EMPTY_CATALOGUE, {
  id: 'p2-1',
  round: 2,
  slot: 1,
  title: 'Gutschein',
  valueChf: 30,
  winCondition: { kind: 'ONE_LINE' },
});

function results(): EventResults {
  const { log, game } = evening();
  return computeResults({ game, log, catalogue, settings: SETTINGS });
}

function round(all: EventResults, number: number): RoundSummary {
  const found = all.rounds.find((entry) => entry.round === number);
  if (found === undefined) throw new Error(`round ${number} missing`);
  return found;
}

describe('computeResults', () => {
  it('summarises a completed round with times from UTC instants', () => {
    const first = round(results(), 1);
    expect(first.status).toBe('COMPLETED');
    expect(first.startedAt).toBe('2026-11-07T17:00:00.000Z');
    expect(first.endedAt).toBe('2026-11-07T17:15:00.000Z');
    expect(first.durationMs).toBe(15 * 60_000);
    expect(first.draws).toBe(6);
    expect(first.falseClaims).toBe(1);
    expect(first.revokedAwards).toBe(1);
    expect(first.runs).toBe(1);
    expect(first.prizes.map((prize) => prize.status)).toEqual([
      'AWARDED',
      'SKIPPED',
      'AWARDED',
      'AWARDED',
    ]);
  });

  it('reports late claims with the draw that completed them, after corrections', () => {
    const [first] = round(results(), 1).prizes;
    expect(first).toMatchObject({
      title: 'Präsentkorb',
      valueChf: 50.5,
      sponsor: 'Bäckerei Frei',
      drawCount: 6,
      handout: 'COLLECTED',
      corrections: 1,
      condition: { kind: 'ONE_LINE' },
    });
    expect(first?.winners).toEqual([
      {
        cardNo: '18',
        name: 'Anna Muster',
        note: undefined,
        validSinceSeq: 5,
        validSinceNumber: 42,
        late: true,
      },
    ]);
  });

  it('keeps skip reasons and the Stechen passes with the winning claimant', () => {
    const [, skipped, stechen, fourth] = round(results(), 1).prizes;
    expect(skipped).toMatchObject({
      status: 'SKIPPED',
      skipReason: 'Kein Preis vorhanden',
      winners: [],
    });
    expect(stechen?.winners[0]).toMatchObject({
      cardNo: '30',
      validSinceSeq: 6,
      validSinceNumber: 61,
      late: false,
    });
    expect(stechen?.tiebreak).toEqual({
      claimants: [{ cardNo: '12' }, { cardNo: '30' }],
      passes: [
        {
          pass: 1,
          draws: [
            { claimant: 0, number: 40 },
            { claimant: 1, number: 40 },
          ],
        },
        {
          pass: 2,
          draws: [
            { claimant: 0, number: 10 },
            { claimant: 1, number: 80 },
          ],
        },
      ],
      winner: 1,
    });
    expect(fourth).toMatchObject({
      title: undefined,
      condition: { kind: 'FULL_CARD' },
      handout: 'OPEN',
    });
    expect(fourth?.winners.map((winner) => winner.cardNo)).toEqual(['1', '2']);
    expect(fourth?.tiebreak).toBeUndefined();
  });

  it('describes aborted and upcoming rounds from the catalogue and template', () => {
    const all = results();
    const second = round(all, 2);
    expect(second).toMatchObject({ status: 'ABORTED', abortReason: 'Stromausfall', draws: 1 });
    expect(second.durationMs).toBe(2 * 60_000);
    expect(second.prizes[0]).toMatchObject({ status: 'OPEN', title: 'Gutschein', valueChf: 30 });
    const third = round(all, 3);
    expect(third).toMatchObject({
      status: 'UPCOMING',
      startedAt: undefined,
      durationMs: undefined,
    });
    expect(third.prizes[3]?.condition).toEqual({ kind: 'ONE_LINE' });
    expect(all.rounds).toHaveLength(24);
  });

  it('totals the evening', () => {
    expect(results().totals).toEqual({
      rounds: 24,
      roundsCompleted: 1,
      roundsAborted: 1,
      roundsRunning: 0,
      roundsUpcoming: 22,
      prizesAwarded: 3,
      prizesSkipped: 1,
      prizesOpen: 92,
      winners: 4,
      handedOut: 1,
      valueAwardedChf: 70.5,
      draws: 7,
      falseClaims: 1,
    });
  });

  it('handles an event without any activity', () => {
    const empty = computeResults({
      game: initialGameState(),
      log: [],
      catalogue: EMPTY_CATALOGUE,
      settings: SETTINGS,
    });
    expect(empty.totals.roundsUpcoming).toBe(24);
    expect(empty.totals.draws).toBe(0);
    expect(empty.rounds[0]?.prizes[0]?.title).toBeUndefined();
  });

  it('marks a running round without an end time', () => {
    const log = buildLog([
      {
        type: 'ROUND_STARTED',
        round: 1,
        rules: { maxNumber: 90, perLine: 5, lines: 3, boardReset: 'ROUND' },
      },
      { type: 'NUMBER_DRAWN', round: 1, draw: { seq: 1, number: 7, method: 'RANDOM' } },
    ]);
    const replayed = replay(log);
    if (!replayed.ok) throw new Error('log does not replay');
    const running = computeResults({ game: replayed.value, log, catalogue, settings: SETTINGS });
    expect(running.totals.roundsRunning).toBe(1);
    expect(round(running, 1)).toMatchObject({
      status: 'RUNNING',
      endedAt: undefined,
      durationMs: undefined,
    });
  });
});

describe('result outputs', () => {
  it('filters played rounds and open handouts', () => {
    const all = results();
    expect(filterRounds(all.rounds, 'PLAYED', false).map((entry) => entry.round)).toEqual([1, 2]);
    expect(filterRounds(all.rounds, 'ALL', false)).toHaveLength(24);
    const open = filterRounds(all.rounds, 'PLAYED', true);
    expect(open.map((entry) => entry.round)).toEqual([1]);
    expect(open[0]?.prizes.map((prize) => prize.slot)).toEqual([3, 4]);
  });

  it('lists one row per winning card', () => {
    const rows = winnerRows(results().rounds);
    expect(rows.map((row) => [row.slot, row.cardNo, row.shared, row.tiebreak, row.late])).toEqual([
      [1, '18', false, false, true],
      [3, '30', false, true, false],
      [4, '1', true, false, false],
      [4, '2', true, false, false],
    ]);
    expect(rows[0]).toMatchObject({ name: 'Anna Muster', handout: 'COLLECTED', drawCount: 6 });
  });

  it('builds the JSON results document', () => {
    const all = results();
    const document = resultsDocument(all, SETTINGS, 'PRACTICE', '2026-11-07T22:00:00.000Z');
    expect(document.format).toBe(RESULTS_FORMAT);
    expect(document.event).toEqual({
      name: 'Lottomatch 2026',
      date: '2026-11-07',
      venue: '',
      kind: 'PRACTICE',
      rounds: 24,
    });
    expect(document.totals).toBe(all.totals);
    const parsed = JSON.parse(JSON.stringify(document)) as {
      rounds: { prizes: { winners: object[] }[] }[];
    };
    expect(parsed.rounds[0]?.prizes[1]?.winners).toEqual([]);
  });
});
