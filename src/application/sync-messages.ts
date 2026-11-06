import * as v from 'valibot';
import { slotSchema, winConditionSchema } from './schemas';

const int = (min: number, max: number) =>
  v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
const text = (max: number) => v.pipe(v.string(), v.maxLength(max * 4));
const optional = v.exactOptional;

const overlaySchema = v.variant('kind', [
  v.object({
    kind: v.literal('WIN'),
    id: text(64),
    round: int(1, 50),
    slot: slotSchema,
    title: optional(text(60)),
    condition: winConditionSchema,
    winners: v.pipe(
      v.array(v.object({ cardNo: optional(text(20)), name: optional(text(80)) })),
      v.maxLength(50),
    ),
    main: v.boolean(),
  }),
  v.object({
    kind: v.literal('ROUND_END'),
    id: text(64),
    round: int(1, 50),
    next: optional(
      v.object({
        round: int(1, 50),
        prizes: v.pipe(
          v.array(
            v.object({
              slot: slotSchema,
              title: optional(text(60)),
              condition: winConditionSchema,
              imageId: optional(text(64)),
            }),
          ),
          v.maxLength(4),
        ),
      }),
    ),
  }),
  v.object({
    kind: v.literal('PAUSE'),
    id: text(64),
    message: text(120),
    resumeAt: optional(v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/))),
    sponsors: v.pipe(v.array(text(60)), v.maxLength(50)),
  }),
  v.object({ kind: v.literal('GAME_END'), id: text(64), name: text(80) }),
]);

const progressSchema = v.picklist(['AWARDED', 'ACTIVE', 'UPCOMING', 'SKIPPED']);
const themeSchema = v.picklist(['SYSTEM', 'DARK', 'LIGHT']);

export const snapshotSchema = v.object({
  v: v.literal(1),
  epoch: int(0, Number.MAX_SAFE_INTEGER),
  seq: int(0, Number.MAX_SAFE_INTEGER),
  matchId: text(64),
  practice: v.boolean(),
  date: optional(text(10)),
  venue: optional(text(80)),
  phase: v.picklist(['READY', 'ROUND_RUNNING', 'BETWEEN_ROUNDS', 'COMPLETED']),
  round: optional(int(1, 50)),
  totalRounds: int(1, 50),
  ring: v.pipe(v.array(v.picklist(['DONE', 'CURRENT', 'UPCOMING', 'ABORTED'])), v.maxLength(50)),
  prize: optional(
    v.object({
      slot: slotSchema,
      title: optional(text(60)),
      description: optional(text(200)),
      valueChf: optional(v.pipe(v.number(), v.finite(), v.minValue(0))),
      sponsor: optional(text(60)),
      imageId: optional(text(64)),
      condition: winConditionSchema,
    }),
  ),
  progress: v.pipe(v.array(progressSchema), v.maxLength(4)),
  maxNumber: int(1, 99),
  drawn: v.pipe(v.array(int(1, 99)), v.maxLength(99)),
  latest: optional(
    v.object({ number: int(1, 99), seq: int(1, 10_000), method: v.picklist(['RANDOM', 'MANUAL']) }),
  ),
  reveal: optional(v.object({ key: text(64), durationMs: int(0, 10_000), instant: v.boolean() })),
  overlay: optional(overlaySchema),
  theme: themeSchema,
  animation: v.picklist(['OFF', 'SHORT', 'NORMAL', 'THRILL']),
  performanceMode: v.boolean(),
  locale: v.picklist(['de-CH', 'en']),
});

export type DisplaySnapshot = v.InferOutput<typeof snapshotSchema>;
export type DisplayOverlay = v.InferOutput<typeof overlaySchema>;
export type PrizeProgress = v.InferOutput<typeof progressSchema>;

export const syncMessageSchema = v.variant('t', [
  v.object({ t: v.literal('snapshot'), snapshot: snapshotSchema }),
  v.object({ t: v.literal('hello'), role: v.picklist(['display', 'host']), from: text(64) }),
  v.object({
    t: v.literal('display-alive'),
    from: text(64),
    epoch: int(0, Number.MAX_SAFE_INTEGER),
    seq: int(0, Number.MAX_SAFE_INTEGER),
  }),
  v.object({
    t: v.literal('persisted'),
    matchId: text(64),
    logSeq: int(0, Number.MAX_SAFE_INTEGER),
  }),
  v.object({ t: v.literal('takeover-request'), from: text(64) }),
  v.object({ t: v.literal('takeover-ready'), to: text(64) }),
  v.object({ t: v.literal('reload') }),
]);

export type SyncMessage = v.InferOutput<typeof syncMessageSchema>;

/** Validates a message received from another window; foreign or malformed data is dropped. */
export function parseSyncMessage(input: unknown): SyncMessage | undefined {
  const result = v.safeParse(syncMessageSchema, input);
  return result.success ? result.output : undefined;
}

/** True when snapshot `a` is newer than position `(epoch, seq)`. */
export function isNewer(
  a: Pick<DisplaySnapshot, 'epoch' | 'seq'>,
  epoch: number,
  seq: number,
): boolean {
  return a.epoch > epoch || (a.epoch === epoch && a.seq > seq);
}
