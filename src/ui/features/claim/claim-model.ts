import {
  checkClaimNumber,
  claimVerdict,
  evaluateClaim,
  type ClaimEvaluation,
  type ClaimVerdict,
} from '../../../domain/claim';
import { parseDrawnNumber } from '../../../domain/number-input';
import { err, ok, type Result } from '../../../domain/result';
import type { LateClaimPolicy } from '../../../domain/settings';
import type { DrawEntry } from '../../../domain/state';
import type { WinnerInput } from '../../../domain/winner';

export type AddNumberError =
  | { readonly code: 'NOT_A_NUMBER' }
  | { readonly code: 'OUT_OF_RANGE'; readonly max: number }
  | { readonly code: 'DUPLICATE'; readonly number: number };

/** Validates typed input and appends it as a chip (duplicates rejected). */
export function addClaimNumber(
  numbers: readonly number[],
  raw: string,
  max: number,
): Result<readonly number[], AddNumberError> {
  const parsed = parseDrawnNumber(raw, max);
  if (!parsed.ok) {
    return err(
      parsed.error.code === 'OUT_OF_RANGE'
        ? { code: 'OUT_OF_RANGE', max }
        : { code: 'NOT_A_NUMBER' },
    );
  }
  const problem = checkClaimNumber(parsed.value, numbers, max);
  if (problem === 'DUPLICATE') return err({ code: 'DUPLICATE', number: parsed.value });
  return ok([...numbers, parsed.value]);
}

/** A card the host admitted as a valid claim. */
export interface AdmittedCard {
  readonly id: number;
  readonly cardNo: string;
  /** Draw that completed the claim; absent when confirmed without a check. */
  readonly validSinceSeq?: number;
}

export interface CardCheck {
  readonly evaluation: ClaimEvaluation;
  readonly verdict: ClaimVerdict;
}

/** Evaluates the card being entered against the active pool and the late-claim policy. */
export function checkCard(
  pool: readonly DrawEntry[],
  numbers: readonly number[],
  expected: number | undefined,
  policy: LateClaimPolicy,
): CardCheck {
  const evaluation = evaluateClaim(pool, numbers, expected);
  return { evaluation, verdict: claimVerdict(evaluation, policy) };
}

/** True when the entered count is final (expected reached, or ≥ 1 for custom rules). */
export function countReached(numbers: readonly number[], expected: number | undefined): boolean {
  return expected === undefined ? numbers.length > 0 : numbers.length >= expected;
}

/** Winner form values, keyed by card id. */
export interface WinnerDraft {
  readonly cardNo: string;
  readonly name: string;
  readonly note: string;
}

/** Combines an admitted card with its form values into the domain winner input. */
export function toWinnerInput(card: AdmittedCard, draft: WinnerDraft | undefined): WinnerInput {
  return {
    cardNo: draft?.cardNo ?? card.cardNo,
    name: draft?.name,
    note: draft?.note,
    validSinceSeq: card.validSinceSeq,
  };
}
