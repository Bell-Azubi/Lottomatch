import { referencedImages } from '../domain/catalogue';
import type { LogEnvelope } from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';
import { zurichDate, type AppStore } from './app-store';
import {
  checksumInput,
  EXPORT_FORMAT,
  slugify,
  type ExportFile,
  type ExportImage,
} from './backup-format';
import { parseEnvelope } from './schemas';
import type { MatchSession } from './session';

const FLUSH_TIMEOUT_MS = 2_000;

/** Waits for pending writes, but never longer than the timeout (storage may be failing). */
async function flushWithTimeout(app: AppStore): Promise<void> {
  await Promise.race([
    app.queue.flush(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, FLUSH_TIMEOUT_MS);
    }),
  ]);
}

/** The stored log (with hashes) when it is complete, else the in-memory copy. */
async function exportableLog(
  app: AppStore,
  session: MatchSession,
): Promise<readonly LogEnvelope[]> {
  try {
    const stored = (await app.platform.events.load(session.matchId)).map(parseEnvelope);
    const complete =
      stored.length === session.log.length && stored.every((entry) => entry !== undefined);
    return complete ? stored : session.log;
  } catch {
    return session.log;
  }
}

async function exportImages(app: AppStore, session: MatchSession): Promise<ExportImage[]> {
  const images: ExportImage[] = [];
  for (const id of referencedImages(session.catalogue.value)) {
    const image = await app.platform.images.get(id);
    if (image === undefined) continue;
    const type = image.blob.type;
    if (type !== 'image/webp' && type !== 'image/jpeg' && type !== 'image/png') continue;
    images.push({
      id,
      type,
      width: image.width,
      height: image.height,
      data: await app.platform.binary.blobToBase64(image.blob),
    });
  }
  return images;
}

/** Builds the complete export of the active event: settings, prizes, images, log, checksum. */
export async function buildExport(app: AppStore, session: MatchSession): Promise<ExportFile> {
  await flushWithTimeout(app);
  const match = session.match.value;
  const { build, clock, crypto } = app.platform;
  const file: Omit<ExportFile, 'checksum'> = {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: clock.nowIso(),
    app: { version: build.version, commit: build.commit },
    match: { kind: match.kind, settings: match.settings, createdAt: match.createdAt },
    prizes: [...session.catalogue.value.prizes],
    images: await exportImages(app, session),
    log: [...(await exportableLog(app, session))],
  };
  const value = await crypto.sha256Hex(checksumInput(file));
  return { ...file, checksum: { algorithm: 'SHA-256', value } };
}

/** `lottomatch-<name>-<yyyy-MM-dd>-<HHmm>.json` in Europe/Zurich. */
export function exportFileName(name: string, iso: string): string {
  const time = new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  })
    .format(new Date(iso))
    .replace(':', '');
  return `lottomatch-${slugify(name)}-${zurichDate(iso)}-${time}.json`;
}

/** Downloads the backup of the active event and records the backup time (readiness checklist). */
export async function downloadBackup(app: AppStore): Promise<boolean> {
  const session = app.session.value;
  if (session === undefined) return false;
  const file = await buildExport(app, session);
  const text = JSON.stringify(file, null, 2);
  const { binary, screen, clock } = app.platform;
  screen.download(
    exportFileName(session.match.value.settings.name, clock.nowIso()),
    binary.textToBlob(text, 'application/json'),
  );
  session.updateRecord({ lastBackupAt: clock.nowIso() });
  return true;
}
