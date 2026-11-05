import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatCalendarDate,
  formatChf,
  formatDateTime,
  formatDuration,
  formatInteger,
  formatTime,
} from './format';
import { conditionLabel, prizeTitle } from './labels';
import { common } from './de-CH/common';

const modules = import.meta.glob<Record<string, unknown>>(['./de-CH/*.ts', './en/*.ts'], {
  eager: true,
});

/** Calls every message function with sample arguments and collects all resulting strings. */
function collect(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === 'string') {
    out.push({ path, text: value });
  } else if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    for (const args of [[1, 2, 3], ['A', 'B', 'C'], [true], [false], [0, undefined]]) {
      collect(fn(...args), `${path}()`, out);
    }
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collect(entry, `${path}[${index}]`, out);
    });
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) collect(entry, `${path}.${key}`, out);
  }
}

function texts(locale: 'de-CH' | 'en'): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const [file, module] of Object.entries(modules)) {
    if (!file.includes(`/${locale}/`)) continue;
    for (const [name, value] of Object.entries(module)) collect(value, `${file}:${name}`, out);
  }
  return out;
}

describe('message catalogues', () => {
  it('have the same shape in both locales', () => {
    const shape = (locale: 'de-CH' | 'en') =>
      new Set(texts(locale).map((entry) => entry.path.replace(`/${locale}/`, '/')));
    expect([...shape('en')].sort()).toEqual([...shape('de-CH')].sort());
  });

  it('produce non-empty text for every entry', () => {
    for (const locale of ['de-CH', 'en'] as const) {
      for (const entry of texts(locale)) expect(entry.text.trim(), entry.path).not.toBe('');
    }
  });

  it('follow Swiss spelling in de-CH: ss, «…» quotes and ’ (C5)', () => {
    for (const entry of texts('de-CH')) {
      expect(entry.text, entry.path).not.toContain('ß');
      expect(entry.text, entry.path).not.toMatch(/"/);
      expect(entry.text.replace(/\d'\d/g, ''), entry.path).not.toMatch(/'/);
    }
  });
});

describe('formatting (C5)', () => {
  it('formats CHF, numbers, dates, times and durations the Swiss way', () => {
    // ICU versions differ in the de-CH grouping mark (’ or '); Intl is authoritative (C5).
    expect(formatChf(1000.5)).toMatch(/^CHF\s1['’]000\.50$/);
    expect(formatInteger(12345)).toMatch(/^12['’]345$/);
    expect(formatCalendarDate('2026-11-07')).toBe('07.11.2026');
    expect(formatCalendarDate('07.11.2026')).toBe('07.11.2026');
    expect(formatTime('2026-10-25T00:30:00.000Z')).toBe('02:30');
    expect(formatTime('2026-10-25T01:30:00.000Z')).toBe('02:30');
    expect(formatDateTime('2026-11-07T19:05:09.000Z')).toBe('07.11.2026, 20:05:09');
    expect(formatDuration(30_000)).toBe('< 1 min');
    expect(formatDuration(23 * 60_000)).toBe('23 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05 min');
    expect(formatDuration(-5)).toBe('< 1 min');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('labels conditions and gaps', () => {
    expect(conditionLabel({ kind: 'TWO_LINES' }, common)).toBe('2 Linien');
    expect(conditionLabel({ kind: 'CUSTOM', label: 'Ecken' }, common)).toBe('Ecken');
    expect(prizeTitle(undefined, 2, common)).toBe('Preis 2');
    expect(prizeTitle('', 4, common)).toBe('Hauptpreis');
    expect(prizeTitle('Velo', 4, common)).toBe('Velo');
  });
});
