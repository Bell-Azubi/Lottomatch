import { cleanText, LIMITS } from './limits';
import { templateCondition, type ConditionTemplate } from './settings';
import type { Prize, PrizeSlot, PrizeSnapshot, WinCondition } from './types';
import { PRIZE_SLOTS, SUPERLOTTO_ROUND_SLOTS, SUPERLOTTO_SLOT } from './types';
import { textLength, validateWinCondition } from './win-condition';

/** The prizes of one event. A missing (round, slot) is a gap. */
export interface Catalogue {
  readonly prizes: readonly Prize[];
}

export const EMPTY_CATALOGUE: Catalogue = { prizes: [] };

/** True for (round, slot) pairs that may not change, i.e. awarded prizes. */
export type SlotLock = (round: number, slot: PrizeSlot) => boolean;

export type PrizeField = 'title' | 'description' | 'valueChf' | 'sponsor' | 'winCondition';
export type PrizeIssueCode = 'REQUIRED' | 'TOO_LONG' | 'INVALID';

export interface PrizeIssue {
  readonly field: PrizeField;
  readonly code: PrizeIssueCode;
}

/** Editable fields of a prize. */
export interface PrizeDraft {
  readonly title: string;
  readonly description: string;
  readonly valueChf: number | undefined;
  readonly sponsor: string;
  readonly imageId: string | undefined;
  readonly winCondition: WinCondition;
}

function lengthIssue(field: PrizeField, value: string, max: number): PrizeIssue[] {
  return textLength(cleanText(value)) > max ? [{ field, code: 'TOO_LONG' }] : [];
}

/** Validates a prize draft (FR-8 field rules). */
export function validatePrize(draft: PrizeDraft): readonly PrizeIssue[] {
  const issues: PrizeIssue[] = [];
  if (cleanText(draft.title) === '') issues.push({ field: 'title', code: 'REQUIRED' });
  issues.push(...lengthIssue('title', draft.title, LIMITS.title));
  issues.push(...lengthIssue('description', draft.description, LIMITS.description));
  issues.push(...lengthIssue('sponsor', draft.sponsor, LIMITS.sponsor));
  const value = draft.valueChf;
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value < 0 || value > LIMITS.valueChf.max)
  ) {
    issues.push({ field: 'valueChf', code: 'INVALID' });
  }
  if (!validateWinCondition(draft.winCondition))
    issues.push({ field: 'winCondition', code: 'INVALID' });
  return issues;
}

/** Builds a stored prize from a validated draft. */
export function prizeFromDraft(
  id: string,
  round: number,
  slot: PrizeSlot,
  draft: PrizeDraft,
): Prize {
  const description = cleanText(draft.description);
  const sponsor = cleanText(draft.sponsor);
  const winCondition: WinCondition =
    draft.winCondition.kind === 'CUSTOM'
      ? { kind: 'CUSTOM', label: cleanText(draft.winCondition.label) }
      : draft.winCondition;
  return {
    id,
    round,
    slot,
    title: cleanText(draft.title),
    ...(description === '' ? {} : { description }),
    ...(draft.valueChf === undefined ? {} : { valueChf: draft.valueChf }),
    ...(sponsor === '' ? {} : { sponsor }),
    ...(draft.imageId === undefined ? {} : { imageId: draft.imageId }),
    winCondition,
  };
}

/** Prize at a position, if any. */
export function prizeAt(catalogue: Catalogue, round: number, slot: PrizeSlot): Prize | undefined {
  return catalogue.prizes.find((p) => p.round === round && p.slot === slot);
}

/** Win condition of a slot: the prize's own, else the template (gaps use the template). */
export function conditionFor(
  catalogue: Catalogue,
  template: ConditionTemplate,
  round: number,
  slot: PrizeSlot,
): WinCondition {
  return prizeAt(catalogue, round, slot)?.winCondition ?? templateCondition(template, slot);
}

/** Snapshot recorded with an award. */
export function snapshotOf(prize: Prize | undefined, condition: WinCondition): PrizeSnapshot {
  if (prize === undefined) return { winCondition: condition };
  return {
    title: prize.title,
    winCondition: condition,
    ...(prize.valueChf === undefined ? {} : { valueChf: prize.valueChf }),
    ...(prize.sponsor === undefined ? {} : { sponsor: prize.sponsor }),
  };
}

function sortPrizes(prizes: Prize[]): readonly Prize[] {
  return prizes.sort((a, b) => a.round - b.round || a.slot - b.slot);
}

/** Inserts or replaces the prize at its position. */
export function upsertPrize(catalogue: Catalogue, prize: Prize): Catalogue {
  const rest = catalogue.prizes.filter((p) => !(p.round === prize.round && p.slot === prize.slot));
  return { prizes: sortPrizes([...rest, prize]) };
}

/** Removes the prize at a position (turning it into a gap). */
export function removePrize(catalogue: Catalogue, round: number, slot: PrizeSlot): Catalogue {
  return { prizes: catalogue.prizes.filter((p) => !(p.round === round && p.slot === slot)) };
}

/** The prizes a round will play: the four, plus the Superlotto when one is entered. */
export function plannedSlots(catalogue: Catalogue, round: number): readonly PrizeSlot[] {
  return prizeAt(catalogue, round, SUPERLOTTO_SLOT) === undefined
    ? PRIZE_SLOTS
    : SUPERLOTTO_ROUND_SLOTS;
}

/** The rounds with a Superlotto entered. */
export function superlottoRounds(catalogue: Catalogue): ReadonlySet<number> {
  return new Set(catalogue.prizes.filter((p) => p.slot === SUPERLOTTO_SLOT).map((p) => p.round));
}

export interface RoundGaps {
  readonly round: number;
  readonly slots: readonly PrizeSlot[];
}

/** Rounds 1–R with one of the four prizes missing; a round needs no Superlotto. */
export function findGaps(catalogue: Catalogue, totalRounds: number): readonly RoundGaps[] {
  const gaps: RoundGaps[] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    const slots = PRIZE_SLOTS.filter((slot) => prizeAt(catalogue, round, slot) === undefined);
    if (slots.length > 0) gaps.push({ round, slots });
  }
  return gaps;
}

export interface BulkResult {
  readonly catalogue: Catalogue;
  /** Positions left untouched because they are locked (awarded). */
  readonly skipped: readonly { readonly round: number; readonly slot: PrizeSlot }[];
}

/**
 * Copies the four prizes of a round to other rounds; locked targets are skipped. The Superlotto
 * stays where it is, so a copy never changes which rounds play one.
 */
export function copyRound(
  catalogue: Catalogue,
  from: number,
  targets: readonly number[],
  locked: SlotLock,
  newId: () => string,
): BulkResult {
  let next = catalogue;
  const skipped: { round: number; slot: PrizeSlot }[] = [];
  for (const round of targets.filter((r) => r !== from)) {
    for (const slot of PRIZE_SLOTS) {
      if (locked(round, slot)) {
        skipped.push({ round, slot });
        continue;
      }
      const source = prizeAt(catalogue, from, slot);
      next =
        source === undefined
          ? removePrize(next, round, slot)
          : upsertPrize(next, { ...source, id: newId(), round });
    }
  }
  return { catalogue: next, skipped };
}

/** Applies the template to the four prizes; the Superlotto has no template and keeps its rule. */
export function applyTemplate(
  catalogue: Catalogue,
  template: ConditionTemplate,
  locked: SlotLock,
): BulkResult {
  const skipped: { round: number; slot: PrizeSlot }[] = [];
  const prizes = catalogue.prizes.map((prize) => {
    if (prize.slot === SUPERLOTTO_SLOT) return prize;
    if (!locked(prize.round, prize.slot)) return { ...prize, winCondition: template[prize.slot] };
    skipped.push({ round: prize.round, slot: prize.slot });
    return prize;
  });
  return { catalogue: { prizes }, skipped };
}

/** Removes the unlocked prizes of a round. */
export function clearRound(catalogue: Catalogue, round: number, locked: SlotLock): BulkResult {
  const skipped = SUPERLOTTO_ROUND_SLOTS.filter(
    (slot) => locked(round, slot) && prizeAt(catalogue, round, slot) !== undefined,
  ).map((slot) => ({ round, slot }));
  const prizes = catalogue.prizes.filter((p) => p.round !== round || locked(p.round, p.slot));
  return { catalogue: { prizes }, skipped };
}

/** Sum of the CHF values of the prizes in rounds 1–R. */
export function totalPrizeValue(catalogue: Catalogue, totalRounds: number): number {
  const cents = catalogue.prizes
    .filter((p) => p.round <= totalRounds)
    .reduce((sum, p) => sum + Math.round((p.valueChf ?? 0) * 100), 0);
  return cents / 100;
}

/** Image ids referenced by the catalogue. */
export function referencedImages(catalogue: Catalogue): ReadonlySet<string> {
  return new Set(catalogue.prizes.flatMap((p) => (p.imageId === undefined ? [] : [p.imageId])));
}
