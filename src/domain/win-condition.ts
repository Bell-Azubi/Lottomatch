import { cleanText, LIMITS } from './limits';
import type { RoundRules, WinCondition } from './types';

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

/**
 * Number of claimed numbers a check expects for a condition and card layout.
 * Returns `undefined` for custom rules, whose size is free.
 */
export function expectedClaimSize(
  condition: WinCondition,
  rules: Pick<RoundRules, 'perLine' | 'lines'>,
): number | undefined {
  switch (condition.kind) {
    case 'ONE_LINE':
      return rules.perLine;
    case 'TWO_LINES':
      return rules.perLine * Math.min(2, rules.lines);
    case 'FULL_CARD':
      return rules.perLine * rules.lines;
    case 'CUSTOM':
      return undefined;
  }
}
