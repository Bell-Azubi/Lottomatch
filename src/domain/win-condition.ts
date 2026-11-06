import { cleanText, LIMITS } from './limits';
import type { WinCondition } from './types';

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
