import type { LateClaimPolicy } from './settings';
import type { DrawEntry } from './state';

/** Result of checking claimed numbers against the active pool (FR-6). */
export interface ClaimEvaluation {
  readonly claimed: readonly number[];
  /** Claimed numbers that are drawn, with the draw that produced them. */
  readonly drawn: readonly { readonly number: number; readonly seq: number }[];
  /** Claimed numbers that are not drawn, in claim order. */
  readonly missing: readonly number[];
  /** Expected number of claimed numbers, or `undefined` when free (custom rule). */
  readonly expected: number | undefined;
  readonly countMatches: boolean;
  /** All claimed numbers drawn and the count matches. */
  readonly complete: boolean;
  /** Draw that completed the claim (latest of the claimed draws), when complete. */
  readonly validSince?: { readonly seq: number; readonly number: number };
  /** Latest draw of the pool. */
  readonly latest?: { readonly seq: number; readonly number: number };
  /** Complete, but already complete before the latest draw. */
  readonly late: boolean;
}

/** Evaluates a claim against the drawn numbers of the active pool. */
export function evaluateClaim(
  pool: readonly DrawEntry[],
  claimed: readonly number[],
  expected: number | undefined,
): ClaimEvaluation {
  const bySeq = new Map(pool.map((d) => [d.number, d.seq]));
  const drawn: { number: number; seq: number }[] = [];
  const missing: number[] = [];
  for (const number of claimed) {
    const seq = bySeq.get(number);
    if (seq === undefined) missing.push(number);
    else drawn.push({ number, seq });
  }
  const countMatches = expected === undefined ? claimed.length > 0 : claimed.length === expected;
  const complete = countMatches && missing.length === 0;
  const lastDraw = pool.at(-1);
  const latest =
    lastDraw === undefined ? undefined : { seq: lastDraw.seq, number: lastDraw.number };
  let validSince: { seq: number; number: number } | undefined;
  if (complete) {
    for (const entry of drawn) {
      if (validSince === undefined || entry.seq > validSince.seq) validSince = entry;
    }
  }
  const late = validSince !== undefined && latest !== undefined && validSince.seq < latest.seq;
  return {
    claimed,
    drawn,
    missing,
    expected,
    countMatches,
    complete,
    ...(validSince === undefined ? {} : { validSince }),
    ...(latest === undefined ? {} : { latest }),
    late,
  };
}

export type ClaimVerdict = 'VALID' | 'INVALID' | 'LATE_REJECTED' | 'LATE_DECIDE';

/** Applies the late-claim policy to an evaluation. Incomplete counts are `INVALID`. */
export function claimVerdict(evaluation: ClaimEvaluation, policy: LateClaimPolicy): ClaimVerdict {
  if (!evaluation.complete) return 'INVALID';
  if (!evaluation.late) return 'VALID';
  switch (policy) {
    case 'ALLOW':
      return 'VALID';
    case 'REJECT':
      return 'LATE_REJECTED';
    case 'HOST_DECIDES':
      return 'LATE_DECIDE';
  }
}

export type ClaimNumberError = 'NOT_A_NUMBER' | 'OUT_OF_RANGE' | 'DUPLICATE';

/** Validates one more claimed number before it becomes a chip. */
export function checkClaimNumber(
  value: number,
  claimed: readonly number[],
  max: number,
): ClaimNumberError | undefined {
  if (!Number.isInteger(value)) return 'NOT_A_NUMBER';
  if (value < 1 || value > max) return 'OUT_OF_RANGE';
  return claimed.includes(value) ? 'DUPLICATE' : undefined;
}
