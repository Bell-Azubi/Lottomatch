import { describe, expect, it } from 'vitest';
import { webCrypto } from '../infrastructure/crypto';
import { createTestHost, type TestHost } from '../test/test-platform';
import { buildExport } from './backup-export';
import type { ExportFile } from './backup-format';
import { commitImport, previewImport } from './backup-import';
import { parseEnvelope } from './schemas';
import type { MatchSession } from './session';

const sha = (text: string) => webCrypto.sha256Hex(text);

function sessionOf(host: TestHost): MatchSession {
  const session = host.app.session.value;
  if (session === undefined) throw new Error('no active session');
  return session;
}

async function exported(): Promise<{ test: TestHost; file: ExportFile }> {
  const test = await createTestHost();
  await test.platform.images.put({
    id: 'img1',
    blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }),
    width: 32,
    height: 24,
    createdAt: '2026-11-07T18:00:00.000Z',
  });
  sessionOf(test).updateCatalogue(
    {
      prizes: [
        {
          id: 'p1',
          round: 1,
          slot: 1,
          title: 'Präsentkorb',
          imageId: 'img1',
          winCondition: { kind: 'ONE_LINE' },
        },
      ],
    },
    'TEST',
    [1],
  );
  test.host.startRound();
  test.host.spin();
  test.host.award({ winners: [{ cardNo: '7', name: 'Anna' }] });
  return { test, file: await buildExport(test.app, sessionOf(test)) };
}

/** A copy without checksum, so structural errors are reached. */
function unsigned(file: ExportFile, patch: Record<string, unknown>): string {
  const { checksum: _checksum, ...rest } = file;
  return JSON.stringify({ ...rest, ...patch });
}

async function errorOf(text: string): Promise<unknown> {
  const result = await previewImport(text, sha);
  return result.ok ? undefined : result.error;
}

describe('previewImport and commitImport', () => {
  it('round-trips an export into a new, active event', async () => {
    const { test, file } = await exported();
    const source = sessionOf(test).matchId;
    const preview = await previewImport(JSON.stringify(file), sha);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.value).toMatchObject({
      name: 'Lottomatch',
      kind: 'REAL',
      rounds: 24,
      prizes: 1,
      images: 1,
      logEntries: 3,
      awards: 1,
      checksum: 'VERIFIED',
    });
    expect(preview.value.migratedFrom).toBeUndefined();
    const result = await commitImport(test.app, test.admin, preview.value.file);
    expect(result.ok).toBe(true);
    const imported = sessionOf(test);
    expect(imported.matchId).not.toBe(source);
    expect(test.app.matches.value).toHaveLength(2);
    expect(imported.catalogue.value.prizes[0]?.title).toBe('Präsentkorb');
    expect(imported.game.value.rounds.get(1)?.prizes[1].award?.winners).toEqual([
      { cardNo: '7', name: 'Anna' },
    ]);
    expect((await test.platform.images.get('img1'))?.blob.type).toBe('image/jpeg');
    const stored = (await test.platform.events.load(imported.matchId)).map(parseEnvelope);
    expect(stored.every((entry) => entry?.matchId === imported.matchId)).toBe(true);
    expect((await test.platform.events.verify(imported.matchId)).ok).toBe(true);
  });

  it('accepts a BOM and hand-written files without checksum', async () => {
    const { file } = await exported();
    const prepared = unsigned(file, { log: undefined, images: undefined });
    const result = await previewImport(`\uFEFF${prepared}`, sha);
    expect(result.ok && result.value.checksum).toBe('ABSENT');
    expect(result.ok && result.value.logEntries).toBe(0);
  });

  it('names files that are not JSON, foreign or from another version', async () => {
    const { file } = await exported();
    expect(await errorOf('{"format":')).toEqual({ code: 'NOT_JSON' });
    expect(await errorOf('[]')).toEqual({ code: 'FOREIGN' });
    expect(await errorOf('{"format":"other"}')).toEqual({ code: 'FOREIGN' });
    expect(await errorOf(unsigned(file, { schemaVersion: 2 }))).toEqual({
      code: 'TOO_NEW',
      version: 2,
    });
    expect(await errorOf(unsigned(file, { schemaVersion: 0 }))).toEqual({
      code: 'UNSUPPORTED',
      version: 0,
    });
    expect(await errorOf(unsigned(file, { schemaVersion: 'eins' }))).toEqual({ code: 'FOREIGN' });
  });

  it('detects a changed file through the checksum', async () => {
    const { file } = await exported();
    const tampered = { ...file, prizes: [{ ...file.prizes[0], title: 'Fernseher' }] };
    expect(await errorOf(JSON.stringify(tampered))).toEqual({ code: 'CHECKSUM_MISMATCH' });
  });

  it('reports invalid structure, settings, prizes and logs', async () => {
    const { file } = await exported();
    expect(await errorOf(unsigned(file, { match: undefined }))).toEqual({
      code: 'INVALID',
      path: 'match',
    });
    const settings = { ...file.match.settings, maxNumber: 25 };
    expect(await errorOf(unsigned(file, { match: { ...file.match, settings } }))).toEqual({
      code: 'INVALID_SETTINGS',
    });
    const prizes = [{ ...file.prizes[0], round: 30 }];
    expect(await errorOf(unsigned(file, { prizes }))).toEqual({ code: 'INVALID_PRIZES', count: 1 });
    const log = file.log ?? [];
    const second = log[1];
    if (second === undefined) throw new Error('expected a draw');
    const duplicate = { ...second, seq: log.length + 1, id: 'dup' };
    const corrupt = unsigned(file, { log: [...log, duplicate] });
    expect(await errorOf(corrupt)).toEqual({ code: 'LOG_CORRUPT', seq: log.length + 1 });
  });

  it('refuses to import into a read-only window', async () => {
    const { test, file } = await exported();
    const readOnly = await createTestHost({
      documents: test.platform.documents,
      events: test.platform.events,
      lock: {
        acquire: () => Promise.resolve('HELD_ELSEWHERE'),
        steal: () => Promise.resolve(),
        release: () => undefined,
      },
    });
    expect(await commitImport(readOnly.app, readOnly.admin, file)).toEqual({
      ok: false,
      error: 'READ_ONLY',
    });
  });
});
