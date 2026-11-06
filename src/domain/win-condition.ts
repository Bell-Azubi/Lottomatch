import { cleanText, LIMITS } from './limits';
import type { WinCondition, WinConditionKind } from './types';

const CHOOSABLE_CONDITIONS: readonly WinConditionKind[] = ['ONE_LINE', 'FULL_CARD', 'CUSTOM'];

/**
 * Win conditions a form offers. `TWO_LINES` can no longer be chosen (ADR-0026); a stored prize or
 * template that still has it keeps showing it until it is changed.
 */
export function conditionChoices(current: WinConditionKind): readonly WinConditionKind[] {
  return CHOOSABLE_CONDITIONS.includes(current)
    ? CHOOSABLE_CONDITIONS
    : [...CHOOSABLE_CONDITIONS, current];
}

/** Length in Unicode code points, so emoji and umlauts count as one character each. */
export function textLength(value: string): number {
  return Array.from(value).length;
}

/** True when the condition is well formed (custom rules need a label of 1–60 characters). */
export function validateWinCondition(condition: WinCondition): boolean {
  if (condition.kind !== 'CUSTOM') return true;
  const label = cleanText(condition.label);
  return label !== '' && textLength(label) <= LIMITS.customRule;
}

/** Structural equality of two win conditions. */
export function sameCondition(a: WinCondition, b: WinCondition): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'CUSTOM' || (b.kind === 'CUSTOM' && a.label === b.label);
}
