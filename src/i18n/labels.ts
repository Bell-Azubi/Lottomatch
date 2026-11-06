import type { WinCondition } from '../domain/types';
import type { CommonMessages } from './de-CH/common';

/** "1 Reihe", "2 Reihen", "Volle Karte" or the custom rule's own label. */
export function conditionLabel(condition: WinCondition, m: CommonMessages): string {
  return condition.kind === 'CUSTOM' ? condition.label : m.conditions[condition.kind];
}

/** Prize title, falling back to "Preis 2" / "Superlotto" for gaps (FR-8). */
export function prizeTitle(title: string | undefined, slot: number, m: CommonMessages): string {
  return title === undefined || title === '' ? m.prizeSlot(slot) : title;
}
