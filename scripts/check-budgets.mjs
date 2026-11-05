/**
 * Enforces the performance budgets of the brief (§8) on the production build:
 * initial JS ≤ 60 KB gzip, CSS ≤ 20 KB gzip, first load ≤ 250 KB including logo and fonts,
 * and the Preise, Auswertung and Einstellungen pages lazy-loaded.
 */
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const KB = 1024;
const BUDGETS = { js: 60 * KB, css: 20 * KB, firstLoad: 250 * KB };
const LAZY_PAGES = ['PrizesPage', 'ResultsPage', 'SettingsPage', 'HostPage', 'DisplayPage'];
const STATIC_FIRST_LOAD = ['brand/fclk-logo.png', 'icons/favicon-32.png'];

const manifest = JSON.parse(await readFile(join(dist, '.vite', 'manifest.json'), 'utf8'));
const entry = Object.values(manifest).find((chunk) => chunk.isEntry === true);
if (entry === undefined) throw new Error('No entry chunk in the Vite manifest');

/** Static import closure of the entry: what the browser loads before anything is lazy. */
function closure(chunk, seen = new Set()) {
  if (seen.has(chunk.file)) return seen;
  seen.add(chunk.file);
  for (const key of chunk.imports ?? []) closure(manifest[key], seen);
  return seen;
}

const files = closure(entry);
const chunks = Object.values(manifest).filter((chunk) => files.has(chunk.file));
const cssFiles = new Set(chunks.flatMap((chunk) => chunk.css ?? []));
const fontFiles = new Set(
  chunks.flatMap((chunk) => (chunk.assets ?? []).filter((a) => a.endsWith('.woff2'))),
);
const imageFiles = new Set(
  chunks.flatMap((chunk) => (chunk.assets ?? []).filter((a) => a.endsWith('.png'))),
);

async function gzipSize(file) {
  return gzipSync(await readFile(join(dist, file)), { level: 9 }).byteLength;
}

async function rawSize(file) {
  return (await readFile(join(dist, file))).byteLength;
}

async function total(list, measure) {
  let sum = 0;
  for (const file of list) sum += await measure(file);
  return sum;
}

const js = await total([...files], gzipSize);
const css = await total([...cssFiles], gzipSize);
const html = await gzipSize('index.html');
const binaries = await total([...fontFiles, ...imageFiles, ...STATIC_FIRST_LOAD], rawSize);
const firstLoad = js + css + html + binaries;

const eager = chunks
  .map((chunk) => chunk.src ?? chunk.file)
  .filter((name) => LAZY_PAGES.some((page) => name.includes(page)));

const rows = [
  ['Initial JS (gzip)', js, BUDGETS.js],
  ['CSS (gzip)', css, BUDGETS.css],
  ['First load', firstLoad, BUDGETS.firstLoad],
];
let failed = false;
for (const [label, size, budget] of rows) {
  const ok = size <= budget;
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(20)} ${(size / KB).toFixed(1).padStart(7)} KB / ${(budget / KB).toFixed(0)} KB`,
  );
}
if (eager.length > 0) {
  failed = true;
  console.log(`FAIL lazy pages loaded eagerly: ${eager.join(', ')}`);
} else {
  console.log(`ok   lazy pages: ${LAZY_PAGES.join(', ')}`);
}
if (failed) process.exit(1);
