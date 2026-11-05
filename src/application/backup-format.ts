import * as v from 'valibot';
import { canonicalJson } from '../domain/canonical-json';
import type { MatchSettings } from '../domain/settings';
import type { LogEnvelope, Prize } from '../domain/types';
import { envelopeSchema, prizeSchema, settingsSchema } from './schemas';

export const EXPORT_FORMAT = 'lottomatch-live' as const;

const text = (max: number) => v.pipe(v.string(), v.maxLength(max));
const int = (min: number, max: number) =>
  v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));

const imageSchema = v.object({
  id: text(64),
  type: v.picklist(['image/webp', 'image/jpeg', 'image/png']),
  width: int(1, 10_000),
  height: int(1, 10_000),
  data: v.pipe(v.string(), v.maxLength(1_000_000), v.regex(/^[A-Za-z0-9+/]*={0,2}$/)),
});

/**
 * Export and prepared-event file format (schema version 1). Prepared event files in
 * `public/events/` omit `log` and `images`; a checksum is optional for hand-written files.
 */
const exportFileSchema = v.object({
  format: v.literal(EXPORT_FORMAT),
  schemaVersion: int(1, 1_000),
  exportedAt: v.exactOptional(text(40)),
  app: v.exactOptional(v.object({ version: text(40), commit: text(64) })),
  match: v.object({
    kind: v.picklist(['REAL', 'PRACTICE']),
    settings: settingsSchema,
    createdAt: v.exactOptional(text(40)),
  }),
  prizes: v.pipe(v.array(prizeSchema), v.maxLength(1_000)),
  images: v.exactOptional(v.pipe(v.array(imageSchema), v.maxLength(1_000))),
  log: v.exactOptional(v.pipe(v.array(envelopeSchema), v.maxLength(100_000))),
  checksum: v.exactOptional(
    v.object({
      algorithm: v.literal('SHA-256'),
      value: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
    }),
  ),
});

export interface ExportImage {
  readonly id: string;
  readonly type: 'image/webp' | 'image/jpeg' | 'image/png';
  readonly width: number;
  readonly height: number;
  /** Base64 without a data-URL prefix. */
  readonly data: string;
}

/** A validated export or prepared event file. */
export interface ExportFile {
  readonly format: typeof EXPORT_FORMAT;
  readonly schemaVersion: number;
  readonly exportedAt?: string;
  readonly app?: { readonly version: string; readonly commit: string };
  readonly match: {
    readonly kind: 'REAL' | 'PRACTICE';
    readonly settings: MatchSettings;
    readonly createdAt?: string;
  };
  readonly prizes: readonly Prize[];
  readonly images?: readonly ExportImage[];
  readonly log?: readonly LogEnvelope[];
  readonly checksum?: { readonly algorithm: 'SHA-256'; readonly value: string };
}

/** Validates a migrated file; `undefined` with the first issue path when invalid. */
export function parseExportFile(input: unknown): { file: ExportFile } | { issuePath: string } {
  const result = v.safeParse(exportFileSchema, input);
  if (result.success) return { file: result.output };
  const path = result.issues[0].path?.map((item) => String(item.key)).join('.');
  return { issuePath: path === undefined || path === '' ? '(root)' : path };
}

/** Text the checksum covers: the canonical file without its checksum field. */
export function checksumInput(file: Readonly<Record<string, unknown>>): string {
  const { checksum: _checksum, ...rest } = file;
  return canonicalJson(rest);
}

/** File-name friendly slug with Swiss umlaut transliteration. */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'anlass' : slug.slice(0, 48);
}
