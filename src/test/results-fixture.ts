import { replay } from '../domain/reducer';
import { defaultSettings } from '../domain/settings';
import type { GameState } from '../domain/state';
import type { LogEnvelope, LogEvent, RoundRules } from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';

const RULES: RoundRules = { maxNumber: 90, perLine: 5, lines: 3, boardReset: 'ROUND' };

/** Envelopes one minute apart, starting 18:00 Europe/Zurich (17:00 UTC) on 7 November 2026. */
export function buildLog(events: readonly LogEvent[]): LogEnvelope[] {
  return events.map((event, index) => ({
    id: `e${index + 1}`,
    matchId: 'm1',
    seq: index + 1,
    at: new Date(Date.UTC(2026, 10, 7, 17, index)).toISOString(),
    schemaVersion: SCHEMA_VERSION,
    event,
  }));
}

const draw = (round: number, seq: number, number: number): LogEvent => ({
  type: 'NUMBER_DRAWN',
  round,
  draw: { seq, number, method: 'MANUAL' },
});

/**
 * A played evening covering every result feature: a late claim, a false claim, a skip, an undo,
 * a Stechen with a revocation and re-award, a shared fourth prize, a handout, a correction and an
 * aborted second round.
 */
export const EVENING: readonly LogEvent[] = [
  { type: 'ROUND_STARTED', round: 1, rules: RULES },
  draw(1, 1, 5),
  draw(1, 2, 12),
  draw(1, 3, 23),
  draw(1, 4, 34),
  draw(1, 5, 42),
  { type: 'CLAIM_REJECTED', round: 1, slot: 1, claimed: [1, 2], missing: [1, 2] },
  draw(1, 6, 61),
  {
    type: 'PRIZE_AWARDED',
    round: 1,
    slot: 1,
    winners: [{ cardNo: '17', name: 'Anna Muster', validSinceSeq: 5 }],
    prize: {
      title: 'Präsentkorb',
      winCondition: { kind: 'ONE_LINE' },
      valueChf: 50.5,
      sponsor: 'Bäckerei Frei',
    },
  },
  { type: 'PRIZE_SKIPPED', round: 1, slot: 2, reason: 'Kein Preis vorhanden' },
  draw(1, 7, 77),
  { type: 'DRAW_UNDONE', round: 1, seq: 7 },
  {
    type: 'PRIZE_AWARDED',
    round: 1,
    slot: 3,
    winners: [{ cardNo: '30' }],
    prize: { title: 'Wein', winCondition: { kind: 'TWO_LINES' }, valueChf: 20 },
    claimants: [{ cardNo: '12' }, { cardNo: '30' }],
    tiebreak: [
      { claimant: 0, number: 40, pass: 1 },
      { claimant: 1, number: 40, pass: 1 },
      { claimant: 0, number: 10, pass: 2 },
      { claimant: 1, number: 80, pass: 2 },
    ],
  },
  { type: 'AWARD_REVOKED', round: 1, slot: 3, reason: 'Karte falsch gelesen' },
  {
    type: 'PRIZE_AWARDED',
    round: 1,
    slot: 3,
    winners: [{ cardNo: '30', validSinceSeq: 6 }],
    prize: { title: 'Wein', winCondition: { kind: 'TWO_LINES' }, valueChf: 20 },
    claimants: [{ cardNo: '12' }, { cardNo: '30' }],
    tiebreak: [
      { claimant: 0, number: 40, pass: 1 },
      { claimant: 1, number: 40, pass: 1 },
      { claimant: 0, number: 10, pass: 2 },
      { claimant: 1, number: 80, pass: 2 },
    ],
  },
  {
    type: 'PRIZE_AWARDED',
    round: 1,
    slot: 4,
    winners: [{ cardNo: '1' }, { cardNo: '2' }],
    prize: { winCondition: { kind: 'FULL_CARD' } },
  },
  { type: 'HANDOUT_CHANGED', round: 1, slot: 1, status: 'COLLECTED' },
  {
    type: 'WINNER_CORRECTED',
    round: 1,
    slot: 1,
    winners: [{ cardNo: '18', name: 'Anna Muster', validSinceSeq: 5 }],
    reason: 'Tippfehler',
  },
  { type: 'ROUND_STARTED', round: 2, rules: RULES },
  draw(2, 1, 9),
  { type: 'ROUND_ABORTED', round: 2, reason: 'Stromausfall' },
  { type: 'SETTINGS_CHANGED', changes: [{ field: 'venue', from: '', to: 'Turnhalle' }] },
  { type: 'PRIZES_CHANGED', action: 'Runde kopiert', rounds: [3, 4] },
  { type: 'PIN_RESET' },
  { type: 'PERSONAL_DATA_ERASED', winners: 1 },
  { type: 'CONTROL_TAKEN_OVER' },
];

export const SETTINGS = defaultSettings('Lottomatch 2026', '2026-11-07');

/** Log and replayed state of {@link EVENING}. */
export function evening(): { log: LogEnvelope[]; game: GameState } {
  const log = buildLog(EVENING);
  const replayed = replay(log);
  if (!replayed.ok) throw new Error(`fixture does not replay: ${replayed.error.cause.code}`);
  return { log, game: replayed.value };
}
