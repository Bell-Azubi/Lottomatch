import * as v from 'valibot';
import { err, ok, type Result } from '../domain/result';
import { previewImport, type ImportError, type ImportPreview } from './backup-import';
import type { Platform } from './platform';

/** Path of the manifest; static hosting cannot list directories. */
export const MANIFEST_PATH = 'events/index.json';

const FILE_NAME = /^[a-z0-9][a-z0-9-]{0,80}\.json$/;

const manifestSchema = v.pipe(
  v.array(
    v.object({
      file: v.pipe(v.string(), v.regex(FILE_NAME)),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
      description: v.exactOptional(v.pipe(v.string(), v.maxLength(200))),
    }),
  ),
  v.maxLength(100),
);

export type PreparedEventEntry = v.InferOutput<typeof manifestSchema>[number];

export type PreparedEventError =
  | { readonly code: 'UNAVAILABLE' }
  | { readonly code: 'INVALID_MANIFEST' }
  | { readonly code: 'IMPORT'; readonly error: ImportError };

/** Validates the manifest of prepared event files (trust boundary: repository content). */
export function parseManifest(
  text: string,
): Result<readonly PreparedEventEntry[], PreparedEventError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err({ code: 'INVALID_MANIFEST' });
  }
  const parsed = v.safeParse(manifestSchema, raw);
  return parsed.success ? ok(parsed.output) : err({ code: 'INVALID_MANIFEST' });
}

/** Loads the list of prepared event files shipped in `public/events/`. */
export async function loadManifest(
  platform: Pick<Platform, 'fetchText'>,
): Promise<Result<readonly PreparedEventEntry[], PreparedEventError>> {
  try {
    return parseManifest(await platform.fetchText(MANIFEST_PATH));
  } catch {
    return err({ code: 'UNAVAILABLE' });
  }
}

/** Fetches one prepared event file and validates it like any import (preview before commit). */
export async function loadPreparedEvent(
  platform: Pick<Platform, 'fetchText' | 'crypto'>,
  entry: PreparedEventEntry,
): Promise<Result<ImportPreview, PreparedEventError>> {
  if (!FILE_NAME.test(entry.file)) return err({ code: 'INVALID_MANIFEST' });
  let text: string;
  try {
    text = await platform.fetchText(`events/${entry.file}`);
  } catch {
    return err({ code: 'UNAVAILABLE' });
  }
  const preview = await previewImport(text, (input) => platform.crypto.sha256Hex(input));
  return preview.ok ? preview : err({ code: 'IMPORT', error: preview.error });
}
