import type { CsvCodec, CsvRow } from '../application/ports';

const BOM = '\uFEFF';
const FORMULA_START = /^[=+\-@\t\r]/;

/** Detects `;` or `,` from the header line (Excel de-CH writes `;`). */
export function detectDelimiter(text: string): ';' | ',' {
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const semicolons = header.split(';').length - 1;
  const commas = header.split(',').length - 1;
  return semicolons >= commas ? ';' : ',';
}

/**
 * Escapes one cell. Cells that Excel would treat as a formula get a leading apostrophe
 * (CSV injection guard); {@link unguardCell} removes it again on import.
 */
export function escapeCell(value: string): string {
  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\r\n,]|^\s|\s$/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

/** Removes the CSV injection guard added on export. */
export function unguardCell(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

/** CSV for Excel de-CH: UTF-8 with BOM, `;` separators, CRLF line ends; Papa Parse loads lazily. */
export const excelCsv: CsvCodec = {
  async parse(text: string) {
    const { default: Papa } = await import('papaparse');
    const source = text.replace(/^\uFEFF/, '');
    const result = Papa.parse<Record<string, string>>(source, {
      header: true,
      delimiter: detectDelimiter(source),
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      transform: (value) => unguardCell(value.trim()),
    });
    const headers = (result.meta.fields ?? []).filter((field) => field !== '');
    const rows: CsvRow[] = result.data.map((cells, index) => ({ line: index + 2, cells }));
    return { headers, rows };
  },
  serialize(headers, rows) {
    const lines = [headers, ...rows].map((cells) => cells.map(escapeCell).join(';'));
    return `${BOM}${lines.join('\r\n')}\r\n`;
  },
};
