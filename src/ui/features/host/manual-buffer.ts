import { signal } from '@preact/signals';

/** Digits typed for manual entry (host keyboard or keypad); committed only with Enter (FR-3). */
export const manualBuffer = signal('');

/** Inline validation message for the manual entry field. */
export const manualError = signal<string | undefined>(undefined);

const MAX_LENGTH = 3;

export function appendDigit(digit: string): void {
  if (!/^\d$/.test(digit)) return;
  manualError.value = undefined;
  if (manualBuffer.value.length < MAX_LENGTH) manualBuffer.value += digit;
}

export function removeDigit(): void {
  manualError.value = undefined;
  manualBuffer.value = manualBuffer.value.slice(0, -1);
}

export function clearBuffer(): void {
  manualError.value = undefined;
  manualBuffer.value = '';
}
