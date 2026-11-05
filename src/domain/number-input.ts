import { err, ok, type Result } from './result';

export type NumberInputError =
  | { readonly code: 'EMPTY' }
  | { readonly code: 'NOT_A_NUMBER' }
  | { readonly code: 'NOT_INTEGER' }
  | { readonly code: 'OUT_OF_RANGE'; readonly max: number };

const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d*[.,]\d+$|^-?\d+[.,]\d*$/;

/**
 * Parses a typed number for manual entry (FR-3): trims whitespace, accepts leading zeros
 * ("07" → 7) and rejects empty input, letters, decimals and values outside 1–max with a
 * specific error. Never auto-commits; the caller decides when input is complete.
 */
export function parseDrawnNumber(raw: string, max: number): Result<number, NumberInputError> {
  const text = raw.trim();
  if (text === '') return err({ code: 'EMPTY' });
  if (DECIMAL.test(text)) return err({ code: 'NOT_INTEGER' });
  if (!INTEGER.test(text)) return err({ code: 'NOT_A_NUMBER' });
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    return err({ code: 'OUT_OF_RANGE', max });
  return ok(value);
}
