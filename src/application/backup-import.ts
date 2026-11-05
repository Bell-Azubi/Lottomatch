import { validatePrize } from '../domain/catalogue';
import { err, ok, type Result } from '../domain/result';
import { validateSettings } from '../domain/settings';
import type { LogEnvelope } from '../domain/types';
import type { AppStore } from './app-store';
import { checksumInput, EXPORT_FORMAT, parseExportFile, type ExportFile } from './backup-format';
import { validateLog } from './loader';
import type { MatchAdmin } from './match-admin';
import { migrate } from './migrations';
import type { MatchRecord } from './records';

export type ImportError =
  | { readonly code: 'NOT_JSON' }
  | { readonly code: 'FOREIGN' }
  | { readonly code: 'TOO_NEW'; readonly version: number }
  | { readonly code: 'UNSUPPORTED'; readonly version: number }
  | { readonly code: 'CHECKSUM_MISMATCH' }
  | { readonly code: 'INVALID'; readonly path: string }
  | { readonly code: 'INVALID_SETTINGS' }
  | { readonly code: 'INVALID_PRIZES'; readonly count: number }
  | { readonly code: 'LOG_CORRUPT'; readonly seq: number };

/** Summary shown before anything is committed (FR-9 import with preview). */
export interface ImportPreview {
  readonly file: ExportFile;
  readonly name: string;
  readonly date: string;
  readonly kind: ExportFile['match']['kind'];
  readonly rounds: number;
  readonly prizes: number;
  readonly images: number;
  readonly logEntries: number;
  readonly awards: number;
  readonly checksum: 'VERIFIED' | 'ABSENT';
  readonly migratedFrom?: number;
}

/** Parses, migrates, verifies and validates an export or prepared event file. */
export async function previewImport(
  text: string,
  sha256Hex: (input: string) => Promise<string>,
): Promise<Result<ImportPreview, ImportError>> {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return err({ code: 'NOT_JSON' });
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as { format?: unknown }).format !== EXPORT_FORMAT
  ) {
    return err({ code: 'FOREIGN' });
  }
  const originalVersion = (raw as { schemaVersion?: unknown }).schemaVersion;
  const checksum = (raw as { checksum?: { value?: unknown } }).checksum?.value;
  if (typeof checksum === 'string') {
    const actual = await sha256Hex(checksumInput(raw as Record<string, unknown>));
    if (actual !== checksum) return err({ code: 'CHECKSUM_MISMATCH' });
  }
  const migrated = migrate(raw);
  if (!migrated.ok) {
    const error = migrated.error;
    return err(error.code === 'NOT_VERSIONED' ? { code: 'FOREIGN' } : error);
  }
  const parsed = parseExportFile(migrated.value);
  if ('issuePath' in parsed) return err({ code: 'INVALID', path: parsed.issuePath });
  const { file } = parsed;
  if (validateSettings(file.match.settings).length > 0) return err({ code: 'INVALID_SETTINGS' });
  const badPrizes = file.prizes.filter(
    (prize) =>
      prize.round > file.match.settings.rounds ||
      validatePrize({
        ...prize,
        description: prize.description ?? '',
        sponsor: prize.sponsor ?? '',
        valueChf: prize.valueChf,
        imageId: prize.imageId,
      }).length > 0,
  ).length;
  if (badPrizes > 0) return err({ code: 'INVALID_PRIZES', count: badPrizes });
  const log = validateLog(file.log ?? []);
  if (!log.ok)
    return err({ code: 'LOG_CORRUPT', seq: log.error.code === 'LOG_CORRUPT' ? log.error.seq : 0 });
  const awards = (file.log ?? []).filter((entry) => entry.event.type === 'PRIZE_AWARDED').length;
  return ok({
    file,
    name: file.match.settings.name,
    date: file.match.settings.date,
    kind: file.match.kind,
    rounds: file.match.settings.rounds,
    prizes: file.prizes.length,
    images: file.images?.length ?? 0,
    logEntries: file.log?.length ?? 0,
    awards,
    checksum: typeof checksum === 'string' ? 'VERIFIED' : 'ABSENT',
    ...(typeof originalVersion === 'number' && originalVersion !== file.schemaVersion
      ? { migratedFrom: originalVersion }
      : {}),
  });
}

/** Creates a new event from a validated file and switches to it. Nothing is overwritten. */
export async function commitImport(
  app: AppStore,
  admin: MatchAdmin,
  file: ExportFile,
): Promise<Result<MatchRecord, 'READ_ONLY' | 'LOAD_FAILED'>> {
  if (!app.canWrite()) return err('READ_ONLY');
  const { platform } = app;
  const match = app.newMatchRecord(file.match.kind, file.match.settings);
  const log: LogEnvelope[] = (file.log ?? []).map((entry) => {
    const { hash: _hash, prevHash: _prev, ...rest } = entry;
    return { ...rest, matchId: match.id };
  });
  await app.queue.enqueue(async () => {
    for (const image of file.images ?? []) {
      await platform.images.put({
        id: image.id,
        blob: platform.binary.base64ToBlob(image.data, image.type),
        width: image.width,
        height: image.height,
        createdAt: platform.clock.nowIso(),
      });
    }
    await platform.documents.putMatch(match);
    await platform.documents.putCatalogue({ matchId: match.id, version: 1, prizes: file.prizes });
    await platform.events.replaceAll(match.id, log);
  });
  app.upsertMatchInList(match);
  const switched = await admin.switchTo(match.id);
  return switched.ok ? ok(match) : err('LOAD_FAILED');
}
