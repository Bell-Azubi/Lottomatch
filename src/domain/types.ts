/** One of the four prizes every round has. */
export type StandardSlot = 1 | 2 | 3 | 4;

/** Prize position within a round: the four prizes and, in selected rounds, the Superlotto. */
export type PrizeSlot = StandardSlot | 5;

/** The four prizes of every round, in the fixed order in which they resolve. */
export const PRIZE_SLOTS: readonly StandardSlot[] = [1, 2, 3, 4];

/** The Superlotto: an optional fifth prize, played after the four (ADR-0027). */
export const SUPERLOTTO_SLOT = 5;

/** The slots of a round with a Superlotto, in the order in which they resolve. */
export const SUPERLOTTO_ROUND_SLOTS: readonly PrizeSlot[] = [...PRIZE_SLOTS, SUPERLOTTO_SLOT];

/** What a card must show to win a prize. `TWO_LINES` stays for stored data only (ADR-0026). */
export type WinCondition =
  | { readonly kind: 'ONE_LINE' }
  | { readonly kind: 'TWO_LINES' }
  | { readonly kind: 'FULL_CARD' }
  | { readonly kind: 'CUSTOM'; readonly label: string };

export type WinConditionKind = WinCondition['kind'];

/** A prize in the catalogue. A slot without a prize is a gap. */
export interface Prize {
  readonly id: string;
  readonly round: number;
  readonly slot: PrizeSlot;
  readonly title: string;
  readonly description?: string;
  readonly valueChf?: number;
  readonly sponsor?: string;
  readonly imageId?: string;
  readonly winCondition: WinCondition;
}

export type DrawMethod = 'RANDOM' | 'MANUAL';

/** One drawn number. `seq` is the 1-based position of the draw within its round ("Ziehung"). */
export interface Draw {
  readonly seq: number;
  readonly number: number;
  readonly method: DrawMethod;
}

/** A winner of a prize. `name` and `note` are personal data: optional, redactable. */
export interface Winner {
  readonly cardNo?: string;
  readonly name?: string;
  readonly note?: string;
  /** Draw (`Draw.seq`) that completed the checked claim, when numbers were checked. */
  readonly validSinceSeq?: number;
}

export type BoardReset = 'ROUND' | 'PRIZE';

/** Rules frozen when a round starts (invariant I6). */
export interface RoundRules {
  readonly maxNumber: number;
  readonly perLine: number;
  readonly lines: number;
  readonly boardReset: BoardReset;
  /** The round plays a Superlotto. Absent in every round without one, and in older logs. */
  readonly superlotto?: true;
}

/** What was awarded, captured at award time so results stay verifiable. */
export interface PrizeSnapshot {
  readonly title?: string;
  readonly winCondition: WinCondition;
  readonly valueChf?: number;
  readonly sponsor?: string;
}

/** One Stechen draw: `claimant` indexes `PRIZE_AWARDED.claimants`; `pass` starts at 1. */
export interface TiebreakDraw {
  readonly claimant: number;
  readonly number: number;
  readonly pass: number;
}

export type HandoutStatus = 'OPEN' | 'COLLECTED';

/** Events that change the game state. */
export type GameEvent =
  | {
      readonly type: 'ROUND_STARTED';
      readonly round: number;
      readonly rules: RoundRules;
      readonly reason?: string;
    }
  | { readonly type: 'NUMBER_DRAWN'; readonly round: number; readonly draw: Draw }
  | { readonly type: 'DRAW_UNDONE'; readonly round: number; readonly seq: number }
  | {
      readonly type: 'CLAIM_REJECTED';
      readonly round: number;
      readonly slot: PrizeSlot;
      readonly claimed: readonly number[];
      readonly missing: readonly number[];
      readonly lateSinceSeq?: number;
    }
  | {
      readonly type: 'PRIZE_AWARDED';
      readonly round: number;
      readonly slot: PrizeSlot;
      readonly winners: readonly Winner[];
      readonly prize: PrizeSnapshot;
      readonly claimants?: readonly Winner[];
      readonly tiebreak?: readonly TiebreakDraw[];
    }
  | {
      readonly type: 'AWARD_REVOKED';
      readonly round: number;
      readonly slot: PrizeSlot;
      readonly reason: string;
    }
  | {
      readonly type: 'PRIZE_SKIPPED';
      readonly round: number;
      readonly slot: PrizeSlot;
      readonly reason: string;
    }
  | { readonly type: 'ROUND_ABORTED'; readonly round: number; readonly reason: string }
  | {
      readonly type: 'WINNER_CORRECTED';
      readonly round: number;
      readonly slot: PrizeSlot;
      readonly winners: readonly Winner[];
      readonly reason: string;
    }
  | {
      readonly type: 'HANDOUT_CHANGED';
      readonly round: number;
      readonly slot: PrizeSlot;
      readonly status: HandoutStatus;
    }
  | { readonly type: 'EVENT_COMPLETED' };

/** One changed field in an audit entry, rendered as text. */
export interface AuditChange {
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

/** Events recorded for the audit trail only; they never change the game state. */
export type AuditEvent =
  | { readonly type: 'SETTINGS_CHANGED'; readonly changes: readonly AuditChange[] }
  | { readonly type: 'PRIZES_CHANGED'; readonly action: string; readonly rounds: readonly number[] }
  | { readonly type: 'PIN_RESET' }
  | { readonly type: 'PERSONAL_DATA_ERASED'; readonly winners: number }
  | { readonly type: 'CONTROL_TAKEN_OVER' };

export type LogEvent = GameEvent | AuditEvent;

/** Persisted envelope around a log event. Ordering uses `seq` only, never `at` (I7). */
export interface LogEnvelope {
  readonly id: string;
  readonly matchId: string;
  /** Strictly increasing per match, starting at 1. */
  readonly seq: number;
  /** UTC ISO timestamp; informational only. */
  readonly at: string;
  readonly schemaVersion: number;
  readonly prevHash?: string;
  readonly hash?: string;
  readonly event: LogEvent;
}

/** Fields of a winner that hold personal data and are excluded from the hash chain. */
export const REDACTABLE_WINNER_FIELDS = ['name', 'note'] as const;

/** Current schema version of persisted and exported data. */
export const SCHEMA_VERSION = 1;
