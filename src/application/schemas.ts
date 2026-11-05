import * as v from 'valibot';
import type { LogEnvelope } from '../domain/types';
import type { CatalogueRecord, MatchRecord, PinRecord, Preferences } from './records';

/** Shared building blocks for every trust boundary (storage, files, channel messages). */
const text = (max: number) => v.pipe(v.string(), v.maxLength(max * 4));
const int = (min: number, max: number) =>
  v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
const optional = v.exactOptional;

export const slotSchema = v.picklist([1, 2, 3, 4]);

export const winConditionSchema = v.variant('kind', [
  v.object({ kind: v.literal('ONE_LINE') }),
  v.object({ kind: v.literal('TWO_LINES') }),
  v.object({ kind: v.literal('FULL_CARD') }),
  v.object({ kind: v.literal('CUSTOM'), label: text(60) }),
]);

const winnerSchema = v.object({
  cardNo: optional(text(20)),
  name: optional(text(80)),
  note: optional(text(200)),
  validSinceSeq: optional(int(1, 10_000)),
});

const rulesSchema = v.object({
  maxNumber: int(1, 99),
  perLine: int(1, 99),
  lines: int(1, 99),
  boardReset: v.picklist(['ROUND', 'PRIZE']),
});

const money = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(10_000_000));

const snapshotSchema = v.object({
  title: optional(text(60)),
  winCondition: winConditionSchema,
  valueChf: optional(money),
  sponsor: optional(text(60)),
});

const round = int(1, 50);
const reason = text(200);
const numbers = v.pipe(v.array(int(0, 99)), v.maxLength(99));

export const logEventSchema = v.variant('type', [
  v.object({
    type: v.literal('ROUND_STARTED'),
    round,
    rules: rulesSchema,
    reason: optional(reason),
  }),
  v.object({
    type: v.literal('NUMBER_DRAWN'),
    round,
    draw: v.object({
      seq: int(1, 10_000),
      number: int(0, 99),
      method: v.picklist(['RANDOM', 'MANUAL']),
    }),
  }),
  v.object({ type: v.literal('DRAW_UNDONE'), round, seq: int(1, 10_000) }),
  v.object({
    type: v.literal('CLAIM_REJECTED'),
    round,
    slot: slotSchema,
    claimed: numbers,
    missing: numbers,
    lateSinceSeq: optional(int(1, 10_000)),
  }),
  v.object({
    type: v.literal('PRIZE_AWARDED'),
    round,
    slot: slotSchema,
    winners: v.pipe(v.array(winnerSchema), v.maxLength(50)),
    prize: snapshotSchema,
    claimants: optional(v.pipe(v.array(winnerSchema), v.maxLength(50))),
    tiebreak: optional(
      v.pipe(
        v.array(v.object({ claimant: int(0, 49), number: int(0, 99), pass: int(1, 1_000) })),
        v.maxLength(5_000),
      ),
    ),
  }),
  v.object({ type: v.literal('AWARD_REVOKED'), round, slot: slotSchema, reason }),
  v.object({ type: v.literal('PRIZE_SKIPPED'), round, slot: slotSchema, reason }),
  v.object({ type: v.literal('ROUND_ABORTED'), round, reason }),
  v.object({
    type: v.literal('WINNER_CORRECTED'),
    round,
    slot: slotSchema,
    winners: v.pipe(v.array(winnerSchema), v.maxLength(50)),
    reason,
  }),
  v.object({
    type: v.literal('HANDOUT_CHANGED'),
    round,
    slot: slotSchema,
    status: v.picklist(['OPEN', 'COLLECTED']),
  }),
  v.object({ type: v.literal('EVENT_COMPLETED') }),
  v.object({
    type: v.literal('SETTINGS_CHANGED'),
    changes: v.array(v.object({ field: text(40), from: text(400), to: text(400) })),
  }),
  v.object({ type: v.literal('PRIZES_CHANGED'), action: text(40), rounds: v.array(round) }),
  v.object({ type: v.literal('PIN_RESET') }),
  v.object({ type: v.literal('PERSONAL_DATA_ERASED'), winners: int(0, 100_000) }),
  v.object({ type: v.literal('CONTROL_TAKEN_OVER') }),
]);

export const envelopeSchema = v.object({
  id: text(64),
  matchId: text(64),
  seq: int(1, Number.MAX_SAFE_INTEGER),
  at: text(40),
  schemaVersion: int(1, 1_000),
  prevHash: optional(v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))),
  hash: optional(v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))),
  event: logEventSchema,
});

const templateSchema = v.object({
  1: winConditionSchema,
  2: winConditionSchema,
  3: winConditionSchema,
  4: winConditionSchema,
});

export const settingsSchema = v.object({
  name: text(80),
  date: text(10),
  venue: text(80),
  rounds: int(1, 50),
  maxNumber: int(1, 99),
  perLine: int(1, 99),
  lines: int(1, 99),
  template: templateSchema,
  lateClaimPolicy: v.picklist(['ALLOW', 'REJECT', 'HOST_DECIDES']),
  tiePolicy: v.picklist(['TIEBREAK', 'SHARE']),
  tiebreakOrder: v.picklist(['HIGHEST', 'LOWEST']),
  boardReset: v.picklist(['ROUND', 'PRIZE']),
  showNamesOnDisplay: v.boolean(),
  sponsors: v.pipe(v.array(text(60)), v.maxLength(50)),
  payout: v.object({
    enabled: v.boolean(),
    stakesChf: optional(money),
    minRatioPercent: int(0, 100),
  }),
});

export const prizeSchema = v.object({
  id: text(64),
  round,
  slot: slotSchema,
  title: text(60),
  description: optional(text(200)),
  valueChf: optional(money),
  sponsor: optional(text(60)),
  imageId: optional(text(64)),
  winCondition: winConditionSchema,
});

export const matchSchema = v.object({
  id: text(64),
  kind: v.picklist(['REAL', 'PRACTICE']),
  createdAt: text(40),
  updatedAt: text(40),
  archived: v.boolean(),
  settings: settingsSchema,
  settingsVersion: int(0, Number.MAX_SAFE_INTEGER),
  lastBackupAt: optional(text(40)),
  sourceMatchId: optional(text(64)),
});

export const catalogueSchema = v.object({
  matchId: text(64),
  version: int(0, Number.MAX_SAFE_INTEGER),
  prizes: v.pipe(v.array(prizeSchema), v.maxLength(1_000)),
});

export const preferencesSchema = v.object({
  locale: v.picklist(['de-CH', 'en']),
  hostTheme: v.picklist(['SYSTEM', 'DARK', 'LIGHT']),
  displayTheme: v.picklist(['SYSTEM', 'DARK', 'LIGHT']),
  animation: v.picklist(['OFF', 'SHORT', 'NORMAL', 'THRILL']),
  performanceMode: v.boolean(),
  sound: v.boolean(),
  muted: v.boolean(),
  voice: v.boolean(),
  voiceDigits: v.boolean(),
});

export const pinSchema = v.object({
  salt: v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/)),
  hash: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
  iterations: int(1_000, 10_000_000),
});

function parseWith<T>(schema: v.GenericSchema<unknown, T>, input: unknown): T | undefined {
  const result = v.safeParse(schema, input);
  return result.success ? result.output : undefined;
}

/** Validates a stored or imported log envelope. */
export function parseEnvelope(input: unknown): LogEnvelope | undefined {
  return parseWith(envelopeSchema, input);
}

export function parseMatch(input: unknown): MatchRecord | undefined {
  return parseWith(matchSchema, input);
}

export function parseCatalogue(input: unknown): CatalogueRecord | undefined {
  return parseWith(catalogueSchema, input);
}

export function parsePreferences(input: unknown): Preferences | undefined {
  return parseWith(preferencesSchema, input);
}

export function parsePin(input: unknown): PinRecord | undefined {
  return parseWith(pinSchema, input);
}
