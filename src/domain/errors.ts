/** Codes of expected domain failures. The UI maps each code to a message. */
export type DomainErrorCode =
  | 'EVENT_COMPLETED'
  | 'ROUND_RUNNING'
  | 'NO_ROUND_RUNNING'
  | 'ROUND_MISMATCH'
  | 'ROUND_OUT_OF_RANGE'
  | 'ROUND_ALREADY_COMPLETED'
  | 'NO_ROUND_LEFT'
  | 'INVALID_RULES'
  | 'NUMBER_OUT_OF_RANGE'
  | 'NUMBER_ALREADY_DRAWN'
  | 'POOL_EMPTY'
  | 'SEQUENCE_MISMATCH'
  | 'NOTHING_TO_UNDO'
  | 'UNDO_BLOCKED'
  | 'SLOT_MISMATCH'
  | 'NO_AWARD_TO_REVOKE'
  | 'REVOKE_BLOCKED_BY_DRAWS'
  | 'PRIZE_NOT_AWARDED'
  | 'INVALID_WINNERS'
  | 'WINNER_COUNT_MISMATCH'
  | 'INVALID_TIEBREAK'
  | 'INVALID_CLAIM'
  | 'REASON_REQUIRED';

export interface DomainError {
  readonly code: DomainErrorCode;
  /** The number concerned, e.g. for `NUMBER_ALREADY_DRAWN`. */
  readonly number?: number;
  /** The round concerned, e.g. for `ROUND_ALREADY_COMPLETED`. */
  readonly round?: number;
}

/** Creates a domain error. */
export function domainError(
  code: DomainErrorCode,
  details: Omit<DomainError, 'code'> = {},
): DomainError {
  return { code, ...details };
}
