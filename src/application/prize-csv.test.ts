import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOGUE, upsertPrize } from '../domain/catalogue';
import { DEFAULT_TEMPLATE } from '../domain/settings';
import { excelCsv } from '../infrastructure/csv';
import type { CsvRow } from './ports';
import {
  buildPreview,
  exportTable,
  mapHeaders,
  normaliseHeader,
  parseCondition,
  parseSlot,
} from './prize-csv';

const options = { totalRounds: 24, template: DEFAULT_TEMPLATE, locked: () => false };
const headers = ['Runde', 'Preis', 'Titel', 'Beschreibung', 'Wert CHF', 'Sponsor', 'Gewinnregel'];

function row(line: number, cells: readonly string[]): CsvRow {
  return {
    line,
    cells: Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
  };
}

describe('header mapping', () => {
  it('maps German and English aliases, ignoring case, spaces and BOM', () => {
    expect(normaliseHeader('\uFEFF  Wert   CHF ')).toBe('wert chf');
    const mapping = mapHeaders(['\uFEFFRound', 'Prize', 'TITLE', 'Value (CHF)', 'Notes', 'Runde']);
    expect(mapping.columns).toEqual({
      round: '\uFEFFRound',
      slot: 'Prize',
      title: 'TITLE',
      value: 'Value (CHF)',
    });
    expect(mapping.missing).toEqual([]);
    expect(mapping.unknown).toEqual(['Notes', 'Runde']);
  });

  it('reports missing required columns', () => {
    expect(mapHeaders(['Titel']).missing).toEqual(['round', 'slot']);
  });
});

describe('cell parsing', () => {
  it.each([
    ['1', 1],
    ['Preis 2', 2],
    ['p3', 3],
    ['4', 4],
    ['Hauptpreis', 4],
    ['Main prize', 4],
    ['HP', 4],
    ['2.', 2],
  ])('parses slot %j', (raw, slot) => {
    expect(parseSlot(raw)).toBe(slot);
  });

  it.each(['0', '5', 'Preis', 'zwei', ''])('rejects slot %j', (raw) => {
    expect(parseSlot(raw)).toBeUndefined();
  });

  it('parses known win conditions and keeps other text as a custom rule', () => {
    expect(parseCondition('1 Reihe')).toEqual({ kind: 'ONE_LINE' });
    expect(parseCondition('1 Linie')).toEqual({ kind: 'ONE_LINE' });
    expect(parseCondition('Volle Karte')).toEqual({ kind: 'FULL_CARD' });
    expect(parseCondition('  Vier   Ecken ')).toEqual({ kind: 'CUSTOM', label: 'Vier Ecken' });
    expect(parseCondition('')).toBeUndefined();
    expect(parseCondition('x'.repeat(61))).toBe('TOO_LONG');
  });
});

describe('buildPreview', () => {
  it('turns valid rows into prize drafts with template defaults', () => {
    const preview = buildPreview(
      [
        row(2, ['1', '1', 'Präsentkorb', 'Mit Wein', '1’000.50', 'Bäckerei Muster', '']),
        row(3, ['1', 'Hauptpreis', 'Velo', '', '50.–', '', 'Vier Ecken']),
      ],
      headers,
      options,
    );
    expect(preview.errors).toEqual([]);
    expect(preview.total).toBe(2);
    expect(preview.rows).toEqual([
      {
        round: 1,
        slot: 1,
        draft: {
          title: 'Präsentkorb',
          description: 'Mit Wein',
          valueChf: 1000.5,
          sponsor: 'Bäckerei Muster',
          imageId: undefined,
          winCondition: { kind: 'ONE_LINE' },
        },
      },
      {
        round: 1,
        slot: 4,
        draft: {
          title: 'Velo',
          description: '',
          valueChf: 50,
          sponsor: '',
          imageId: undefined,
          winCondition: { kind: 'CUSTOM', label: 'Vier Ecken' },
        },
      },
    ]);
  });

  it('reports a specific error per invalid row', () => {
    const rows = [
      row(2, ['x', '1', 'A']),
      row(3, ['25', '1', 'A']),
      row(4, ['1', '7', 'A']),
      row(5, ['1', '1', '']),
      row(6, ['1', '2', 'y'.repeat(61)]),
      row(7, ['1', '3', 'A', 'd'.repeat(201)]),
      row(8, ['1', '4', 'A', '', '', 's'.repeat(61)]),
      row(9, ['2', '1', 'A', '', 'abc']),
      row(10, ['2', '2', 'A', '', '', '', 'r'.repeat(61)]),
      row(11, ['3', '1', 'A']),
      row(12, ['3', '1', 'B']),
    ];
    const preview = buildPreview(rows, headers, options);
    expect(preview.errors.map((error) => `${error.line}:${error.code}`)).toEqual([
      '2:ROUND_INVALID',
      '3:ROUND_OUT_OF_RANGE',
      '4:SLOT_INVALID',
      '5:TITLE_REQUIRED',
      '6:TITLE_TOO_LONG',
      '7:DESCRIPTION_TOO_LONG',
      '8:SPONSOR_TOO_LONG',
      '9:VALUE_INVALID',
      '10:CONDITION_INVALID',
      '12:DUPLICATE',
    ]);
    expect(preview.rows).toHaveLength(1);
  });

  it('skips awarded slots and stops on missing columns', () => {
    const locked = buildPreview([row(2, ['1', '1', 'A'])], headers, {
      ...options,
      locked: () => true,
    });
    expect(locked.errors).toEqual([{ line: 2, code: 'AWARDED' }]);
    const missing = buildPreview([row(2, ['1'])], ['Runde'], options);
    expect(missing.mapping.missing).toEqual(['slot', 'title']);
    expect(missing.rows).toEqual([]);
  });
});

describe('the removed win condition 2 Reihen (ADR-0026)', () => {
  it.each(['2 Reihen', 'zwei Reihen', '2 rows', '2 Linien', 'Two lines'])(
    'recognises %j',
    (raw) => {
      expect(parseCondition(raw)).toBe('REMOVED');
    },
  );

  it('reports the row instead of importing another rule', () => {
    const preview = buildPreview(
      [{ line: 2, cells: { Runde: '1', Preis: '3', Titel: 'Wein', Gewinnregel: '2 Reihen' } }],
      ['Runde', 'Preis', 'Titel', 'Gewinnregel'],
      options,
    );
    expect(preview.rows).toEqual([]);
    expect(preview.errors).toEqual([{ line: 2, code: 'CONDITION_REMOVED' }]);
  });
});

describe('export round trip', () => {
  it('exports Excel CSV (BOM, semicolons, CRLF) that imports back unchanged', async () => {
    const catalogue = upsertPrize(
      upsertPrize(EMPTY_CATALOGUE, {
        id: 'a',
        round: 2,
        slot: 4,
        title: 'Präsentkorb «Fricktal»; gross',
        description: 'Käse, Wein und Würste',
        valueChf: 1000.5,
        sponsor: 'Bäckerei Müller',
        winCondition: { kind: 'CUSTOM', label: 'Vier Ecken' },
      }),
      { id: 'b', round: 1, slot: 1, title: '=Formel', winCondition: { kind: 'ONE_LINE' } },
    );
    const { headers: exportHeaders, rows } = exportTable(catalogue);
    expect(rows.map((cells) => cells[0])).toEqual(['1', '2']);
    expect(rows[1]?.[1]).toBe('Hauptpreis');
    const text = excelCsv.serialize(exportHeaders, rows);
    expect(text.startsWith('\uFEFFRunde;Preis;Titel')).toBe(true);
    expect(text).toContain('\r\n');
    const parsed = await excelCsv.parse(text);
    const preview = buildPreview(parsed.rows, parsed.headers, options);
    expect(preview.errors).toEqual([]);
    expect(
      preview.rows.map((imported) => [
        imported.round,
        imported.slot,
        imported.draft.title,
        imported.draft.valueChf,
      ]),
    ).toEqual([
      [1, 1, '=Formel', undefined],
      [2, 4, 'Präsentkorb «Fricktal»; gross', 1000.5],
    ]);
    expect(preview.rows[1]?.draft.winCondition).toEqual({ kind: 'CUSTOM', label: 'Vier Ecken' });
    expect(preview.rows[1]?.draft.sponsor).toBe('Bäckerei Müller');
  });

  it('imports comma-separated files too', async () => {
    const parsed = await excelCsv.parse('Round,Prize,Title,Value\n3,2,Kinogutschein,"25,50"\n');
    const preview = buildPreview(parsed.rows, parsed.headers, options);
    expect(preview.rows[0]).toMatchObject({
      round: 3,
      slot: 2,
      draft: { title: 'Kinogutschein', valueChf: 25.5 },
    });
  });
});
