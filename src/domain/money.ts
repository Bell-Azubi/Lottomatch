import { LIMITS } from './limits';
import { err, ok, type Result } from './result';

export type ChfParseError = 'INVALID' | 'NEGATIVE' | 'TOO_MANY_DECIMALS' | 'TOO_LARGE';

const THOUSANDS = /['’ʼ\s]/g;
const DASH_CENTS = /[.,][-–—]$/;
const NUMBER = /^\d+(?:[.,](\d+))?$/;

/**
 * Parses a CHF amount as typed in Switzerland: `50`, `50.–`, `50.50`, `50,50`, `1'000.50`,
 * `1’000.50`. Empty input means "no value". Returns the value in francs, rounded to Rappen.
 */
export function parseChf(raw: string): Result<number | undefined, ChfParseError> {
  let text = raw.trim();
  if (text === '') return ok(undefined);
  if (text.startsWith('-')) return err('NEGATIVE');
  text = text
    .replace(/^CHF\s*/i, '')
    .replace(/\s*CHF$/i, '')
    .replace(THOUSANDS, '')
    .replace(DASH_CENTS, '');
  const match = NUMBER.exec(text);
  if (match === null) return err('INVALID');
  const decimals = match[1];
  if (decimals !== undefined && decimals.length > 2) return err('TOO_MANY_DECIMALS');
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return err('INVALID');
  if (value > LIMITS.valueChf.max) return err('TOO_LARGE');
  return ok(Math.round(value * 100) / 100);
}

/** Serialises a CHF value for CSV and JSON exports (`1000.5` → `1000.50`). */
export function chfToPlain(value: number): string {
  return value.toFixed(2);
}
