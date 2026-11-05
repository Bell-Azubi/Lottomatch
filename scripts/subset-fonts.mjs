/**
 * Subsets Barlow Condensed (SIL OFL 1.1, via @fontsource/barlow-condensed) to the glyphs the
 * app renders with it: digits, A–Z, Ä, Ö, Ü, space and hyphen. Output is committed to
 * src/ui/design-system/fonts/. Run with `npm run fonts` after a font upgrade.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules/@fontsource/barlow-condensed/files');
const target = join(root, 'src/ui/design-system/fonts');
const GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ -';
const WEIGHTS = [
  { weight: 700, name: 'barlow-condensed-700.woff2' },
  { weight: 800, name: 'barlow-condensed-800.woff2' },
];
const BUDGET_BYTES = 25 * 1024;

await mkdir(target, { recursive: true });
let total = 0;
for (const { weight, name } of WEIGHTS) {
  const input = await readFile(join(source, `barlow-condensed-latin-${weight}-normal.woff2`));
  const output = await subsetFont(input, GLYPHS, { targetFormat: 'woff2' });
  await writeFile(join(target, name), output);
  total += output.byteLength;
  console.log(`${name}: ${input.byteLength} -> ${output.byteLength} bytes`);
}
if (total > BUDGET_BYTES) {
  console.error(`Font budget exceeded: ${total} > ${BUDGET_BYTES} bytes`);
  process.exit(1);
}
console.log(`Total ${total} bytes (budget ${BUDGET_BYTES})`);
