import { validatePrize, type Catalogue, type PrizeDraft, type SlotLock } from '../domain/catalogue';
import { cleanText, isIntegerInRange, LIMITS } from '../domain/limits';
import { chfToPlain, parseChf } from '../domain/money';
import type { ConditionTemplate } from '../domain/settings';
import type { PrizeSlot, WinCondition } from '../domain/types';
import { textLength } from '../domain/win-condition';
import type { CsvRow } from './ports';
import type { PrizeImport } from './prize-editor';

export type CsvColumn =
  'round' | 'slot' | 'title' | 'description' | 'value' | 'sponsor' | 'condition';

/** German export headers (Excel de-CH); the import also accepts English names. */
export const CSV_HEADERS: Readonly<Record<CsvColumn, string>> = {
  round: 'Runde',
  slot: 'Preis',
  title: 'Titel',
  description: 'Beschreibung',
  value: 'Wert CHF',
  sponsor: 'Sponsor',
  condition: 'Gewinnregel',
};

const COLUMN_ORDER: readonly CsvColumn[] = [
  'round',
  'slot',
  'title',
  'description',
  'value',
  'sponsor',
  'condition',
];
export const REQUIRED_COLUMNS: readonly CsvColumn[] = ['round', 'slot', 'title'];

const ALIASES: Readonly<Record<CsvColumn, readonly string[]>> = {
  round: ['runde', 'round', 'rd', 'nr', 'runde nr'],
  slot: ['preis', 'prize', 'slot', 'preis nr', 'prize no'],
  title: ['titel', 'title', 'bezeichnung', 'name', 'preisname'],
  description: ['beschreibung', 'description', 'details', 'text'],
  value: ['wert chf', 'wert', 'wert (chf)', 'chf', 'value chf', 'value', 'value (chf)', 'betrag'],
  sponsor: ['sponsor', 'sponsorin', 'stifter', 'gespendet von', 'sponsored by'],
  condition: ['gewinnregel', 'regel', 'win condition', 'condition', 'rule'],
};

/** Lower-case, trimmed, single-spaced header without BOM. */
export function normaliseHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export interface HeaderMapping {
  /** The CSV header used for each recognised column. */
  readonly columns: Readonly<Partial<Record<CsvColumn, string>>>;
  readonly missing: readonly CsvColumn[];
  readonly unknown: readonly string[];
}

/** Maps CSV headers to columns via German and English aliases. */
export function mapHeaders(headers: readonly string[]): HeaderMapping {
  const columns: Partial<Record<CsvColumn, string>> = {};
  const unknown: string[] = [];
  for (const header of headers) {
    const key = normaliseHeader(header);
    const column = COLUMN_ORDER.find((candidate) => ALIASES[candidate].includes(key));
    if (column === undefined || columns[column] !== undefined) unknown.push(header);
    else columns[column] = header;
  }
  return {
    columns,
    missing: REQUIRED_COLUMNS.filter((column) => columns[column] === undefined),
    unknown,
  };
}

/** `1`–`4`, `Preis 2`, `P3`, `Hauptpreis`, `HP`, `Main prize`. */
export function parseSlot(raw: string): PrizeSlot | undefined {
  const text = normaliseHeader(raw);
  if (['hauptpreis', 'hp', 'main prize', 'main', 'haupt'].includes(text)) return 4;
  const match = /^(?:preis|prize|p)?\s*([1-4])\.?$/.exec(text);
  if (match === null) return undefined;
  const slot = Number(match[1]);
  return slot === 1 || slot === 2 || slot === 3 || slot === 4 ? slot : undefined;
}

const CONDITIONS: readonly [WinCondition, readonly string[]][] = [
  [
    { kind: 'ONE_LINE' },
    [
      '1 reihe',
      'eine reihe',
      'reihe',
      '1 row',
      'one row',
      'row',
      // Earlier wording, still in existing Excel files.
      '1 linie',
      'eine linie',
      'linie',
      '1 line',
      'one line',
      'line',
    ],
  ],
  [
    { kind: 'TWO_LINES' },
    [
      '2 reihen',
      'zwei reihen',
      '2 rows',
      'two rows',
      // Earlier wording, still in existing Excel files.
      '2 linien',
      'zwei linien',
      '2 lines',
      'two lines',
    ],
  ],
  [{ kind: 'FULL_CARD' }, ['volle karte', 'voll', 'full card', 'full house', 'karte voll']],
];

/** Known rule names map to their kind; any other text becomes an Eigene Regel label. */
export function parseCondition(raw: string): WinCondition | 'TOO_LONG' | undefined {
  const label = cleanText(raw);
  if (label === '') return undefined;
  const key = label.toLowerCase();
  const known = CONDITIONS.find(([, names]) => names.includes(key));
  if (known !== undefined) return known[0];
  return textLength(label) > LIMITS.customRule ? 'TOO_LONG' : { kind: 'CUSTOM', label };
}

export type RowErrorCode =
  | 'ROUND_INVALID'
  | 'ROUND_OUT_OF_RANGE'
  | 'SLOT_INVALID'
  | 'TITLE_REQUIRED'
  | 'TITLE_TOO_LONG'
  | 'DESCRIPTION_TOO_LONG'
  | 'SPONSOR_TOO_LONG'
  | 'VALUE_INVALID'
  | 'CONDITION_INVALID'
  | 'DUPLICATE'
  | 'AWARDED';

export interface RowError {
  readonly line: number;
  readonly code: RowErrorCode;
}

export interface CsvPreview {
  readonly mapping: HeaderMapping;
  readonly rows: readonly PrizeImport[];
  readonly errors: readonly RowError[];
  readonly total: number;
}

export interface PreviewOptions {
  readonly totalRounds: number;
  readonly template: ConditionTemplate;
  readonly locked: SlotLock;
}

function cell(row: CsvRow, mapping: HeaderMapping, column: CsvColumn): string {
  const header = mapping.columns[column];
  return header === undefined ? '' : (row.cells[header] ?? '').trim();
}

function draftIssue(draft: PrizeDraft): RowErrorCode | undefined {
  const issue = validatePrize(draft)[0];
  if (issue === undefined) return undefined;
  switch (issue.field) {
    case 'title':
      return issue.code === 'REQUIRED' ? 'TITLE_REQUIRED' : 'TITLE_TOO_LONG';
    case 'description':
      return 'DESCRIPTION_TOO_LONG';
    case 'sponsor':
      return 'SPONSOR_TOO_LONG';
    case 'valueChf':
      return 'VALUE_INVALID';
    case 'winCondition':
      return 'CONDITION_INVALID';
  }
}

function parseRow(
  row: CsvRow,
  mapping: HeaderMapping,
  options: PreviewOptions,
): PrizeImport | RowErrorCode {
  const roundText = cell(row, mapping, 'round');
  const round = /^\d+$/.test(roundText) ? Number(roundText) : Number.NaN;
  if (!Number.isInteger(round)) return 'ROUND_INVALID';
  if (!isIntegerInRange(round, 1, options.totalRounds)) return 'ROUND_OUT_OF_RANGE';
  const slot = parseSlot(cell(row, mapping, 'slot'));
  if (slot === undefined) return 'SLOT_INVALID';
  const value = parseChf(cell(row, mapping, 'value'));
  if (!value.ok) return 'VALUE_INVALID';
  const condition = parseCondition(cell(row, mapping, 'condition'));
  if (condition === 'TOO_LONG') return 'CONDITION_INVALID';
  const draft: PrizeDraft = {
    title: cell(row, mapping, 'title'),
    description: cell(row, mapping, 'description'),
    valueChf: value.value,
    sponsor: cell(row, mapping, 'sponsor'),
    imageId: undefined,
    winCondition: condition ?? options.template[slot],
  };
  const issue = draftIssue(draft);
  if (issue !== undefined) return issue;
  return options.locked(round, slot) ? 'AWARDED' : { round, slot, draft };
}

/** Validates every row before anything is committed (FR-8 import preview). */
export function buildPreview(
  rows: readonly CsvRow[],
  headers: readonly string[],
  options: PreviewOptions,
): CsvPreview {
  const mapping = mapHeaders(headers);
  const valid: PrizeImport[] = [];
  const errors: RowError[] = [];
  if (mapping.missing.length > 0) return { mapping, rows: [], errors: [], total: rows.length };
  const seen = new Set<string>();
  for (const row of rows) {
    const parsed = parseRow(row, mapping, options);
    if (typeof parsed === 'string') {
      errors.push({ line: row.line, code: parsed });
      continue;
    }
    const key = `${parsed.round}-${parsed.slot}`;
    if (seen.has(key)) {
      errors.push({ line: row.line, code: 'DUPLICATE' });
      continue;
    }
    seen.add(key);
    valid.push(parsed);
  }
  return { mapping, rows: valid, errors, total: rows.length };
}

function conditionText(condition: WinCondition): string {
  switch (condition.kind) {
    case 'ONE_LINE':
      return '1 Reihe';
    case 'TWO_LINES':
      return '2 Reihen';
    case 'FULL_CARD':
      return 'Volle Karte';
    case 'CUSTOM':
      return condition.label;
  }
}

/** Header and rows for the CSV export, sorted by round and slot. */
export function exportTable(catalogue: Catalogue): { headers: string[]; rows: string[][] } {
  const rows = [...catalogue.prizes]
    .sort((a, b) => a.round - b.round || a.slot - b.slot)
    .map((prize) => [
      String(prize.round),
      prize.slot === 4 ? 'Hauptpreis' : String(prize.slot),
      prize.title,
      prize.description ?? '',
      prize.valueChf === undefined ? '' : chfToPlain(prize.valueChf),
      prize.sponsor ?? '',
      conditionText(prize.winCondition),
    ]);
  return { headers: COLUMN_ORDER.map((column) => CSV_HEADERS[column]), rows };
}
