import { describe, expect, it, vi } from 'vitest';
import { webCrypto } from '../infrastructure/crypto';
import { MemoryEventStore } from '../infrastructure/storage/memory-stores';
import { createTestHost, createTestPlatform, type TestHost } from '../test/test-platform';
import { buildExport, downloadBackup, exportFileName } from './backup-export';
import { checksumInput, slugify } from './backup-format';
import type { MatchSession } from './session';

function sessionOf(host: TestHost): MatchSession {
  const session = host.app.session.value;
  if (session === undefined) throw new Error('no active session');
  return session;
}

async function withImageAndRound(test: TestHost): Promise<void> {
  await test.platform.images.put({
    id: 'img1',
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }),
    width: 64,
    height: 48,
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
          valueChf: 50.5,
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
}

describe('exportFileName', () => {
  it('uses a slug and the Zurich date and time', () => {
    expect(exportFileName('Herbst Lotto 2026', '2026-11-07T19:05:00.000Z')).toBe(
      'lottomatch-herbst-lotto-2026-2026-11-07-2005.json',
    );
    expect(exportFileName('Jahresübersicht', '2026-07-01T10:00:00.000Z')).toBe(
      'lottomatch-jahresuebersicht-2026-07-01-1200.json',
    );
  });

  it('slugifies umlauts and falls back for empty names', () => {
    expect(slugify('Grüsse aus Kaisten & Laufenburg')).toBe('gruesse-aus-kaisten-laufenburg');
    expect(slugify('***')).toBe('anlass');
    expect(slugify('Café')).toBe('cafe');
  });
});

describe('buildExport', () => {
  it('contains settings, prizes, images, the hashed log and a valid checksum', async () => {
    const test = await createTestHost();
    await withImageAndRound(test);
    const file = await buildExport(test.app, sessionOf(test));
    expect(file.format).toBe('lottomatch-live');
    expect(file.schemaVersion).toBe(1);
    expect(file.app).toEqual({ version: '1.0.0', commit: 'test-commit' });
    expect(file.match.settings.name).toBe('Lottomatch');
    expect(file.prizes).toHaveLength(1);
    expect(file.images).toEqual([
      { id: 'img1', type: 'image/webp', width: 64, height: 48, data: 'AQIDBA==' },
    ]);
    expect(file.log?.map((entry) => entry.event.type)).toEqual(['ROUND_STARTED', 'NUMBER_DRAWN']);
    expect(file.log?.every((entry) => entry.hash !== undefined)).toBe(true);
    const expected = await test.platform.crypto.sha256Hex(checksumInput({ ...file }));
    expect(file.checksum).toEqual({ algorithm: 'SHA-256', value: expected });
  });

  it('skips missing images and falls back to the in-memory log', async () => {
    const store = new MemoryEventStore((text) => webCrypto.sha256Hex(text));
    let loadFails = false;
    const test = await createTestHost({
      events: {
        append: () => Promise.resolve(),
        load: (id) => (loadFails ? Promise.reject(new Error('unavailable')) : store.load(id)),
        redactPersonalData: (id) => store.redactPersonalData(id),
        clear: (id) => store.clear(id),
        replaceAll: (id, envelopes) => store.replaceAll(id, envelopes),
        verify: (id) => store.verify(id),
      },
    });
    sessionOf(test).updateCatalogue(
      {
        prizes: [
          {
            id: 'p',
            round: 1,
            slot: 1,
            title: 'X',
            imageId: 'gone',
            winCondition: { kind: 'ONE_LINE' },
          },
        ],
      },
      'TEST',
      [1],
    );
    test.host.startRound();
    const incomplete = await buildExport(test.app, sessionOf(test));
    expect(incomplete.images).toEqual([]);
    expect(incomplete.log).toHaveLength(1);
    expect(incomplete.log?.[0]?.hash).toBeUndefined();
    loadFails = true;
    const unreadable = await buildExport(test.app, sessionOf(test));
    expect(unreadable.log).toHaveLength(1);
  });
});

describe('exported images', () => {
  it('leaves out formats the import does not accept', async () => {
    const test = await createTestHost();
    await test.platform.images.put({
      id: 'gif',
      blob: new Blob([new Uint8Array([71, 73, 70])], { type: 'image/gif' }),
      width: 1,
      height: 1,
      createdAt: '2026-11-07T18:00:00.000Z',
    });
    sessionOf(test).updateCatalogue(
      {
        prizes: [
          {
            id: 'p',
            round: 1,
            slot: 1,
            title: 'GIF',
            imageId: 'gif',
            winCondition: { kind: 'ONE_LINE' },
          },
        ],
      },
      'TEST',
      [1],
    );
    expect((await buildExport(test.app, sessionOf(test))).images).toEqual([]);
  });
});

describe('downloadBackup', () => {
  it('downloads the JSON and records the backup time', async () => {
    const download = vi.fn<(fileName: string, content: Blob) => void>();
    const test = await createTestHost({ screen: { ...createTestPlatform().screen, download } });
    expect(await downloadBackup(test.app)).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    const [name, blob] = download.mock.calls[0] ?? [];
    expect(name).toMatch(/^lottomatch-lottomatch-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(blob?.type).toBe('application/json');
    expect(sessionOf(test).match.value.lastBackupAt).toBeDefined();
  });
});
