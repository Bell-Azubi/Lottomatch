import { describe, expect, it, vi } from 'vitest';
import { webCrypto } from '../infrastructure/crypto';
import { createTestHost } from '../test/test-platform';
import { commitImport } from './backup-import';
import { PREPARED_EVENT } from '../test/prepared-event-fixture';
import manifestText from '../../public/events/index.json?raw';
import { loadManifest, loadPreparedEvent, MANIFEST_PATH, parseManifest } from './prepared-events';

function platformServing(files: Readonly<Record<string, string>>) {
  return {
    crypto: webCrypto,
    fetchText: vi.fn((path: string) => {
      const text = files[path];
      return text === undefined ? Promise.reject(new Error(`404 ${path}`)) : Promise.resolve(text);
    }),
  };
}

describe('manifest', () => {
  it('validates entries and file names', () => {
    expect(parseManifest('[{"file":"a-b.json","name":"A"}]')).toEqual({
      ok: true,
      value: [{ file: 'a-b.json', name: 'A' }],
    });
    expect(parseManifest('[{"file":"../secret.json","name":"A"}]').ok).toBe(false);
    expect(parseManifest('[{"file":"a.json","name":""}]').ok).toBe(false);
    expect(parseManifest('not json').ok).toBe(false);
  });

  it('reports an unavailable manifest', async () => {
    expect(await loadManifest(platformServing({}))).toEqual({
      ok: false,
      error: { code: 'UNAVAILABLE' },
    });
  });

  it('ships no prepared event: prize lists come from the CSV import', async () => {
    const manifest = await loadManifest(platformServing({ [MANIFEST_PATH]: manifestText }));
    expect(manifest).toEqual({ ok: true, value: [] });
  });
});

describe('prepared event files', () => {
  it('previews a prepared file: 24 rounds, 96 prizes, no personal data', async () => {
    const platform = platformServing({ 'events/anlass.json': PREPARED_EVENT });
    const preview = await loadPreparedEvent(platform, { file: 'anlass.json', name: 'Anlass' });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.value).toMatchObject({
      rounds: 24,
      prizes: 96,
      images: 0,
      logEntries: 0,
      awards: 0,
      checksum: 'ABSENT',
    });
    expect(preview.value.file.match.settings.showNamesOnDisplay).toBe(false);
    expect(new Set(preview.value.file.prizes.map((p) => `${p.round}-${p.slot}`)).size).toBe(96);
  });

  it('imports a prepared file as a new active event', async () => {
    const host = await createTestHost();
    const before = host.app.session.value?.matchId;
    const platform = platformServing({ 'events/anlass.json': PREPARED_EVENT });
    const preview = await loadPreparedEvent(platform, { file: 'anlass.json', name: 'Anlass' });
    if (!preview.ok) throw new Error('preview failed');
    const imported = await commitImport(host.app, host.admin, preview.value.file);
    expect(imported.ok).toBe(true);
    expect(host.app.session.value?.matchId).not.toBe(before);
    expect(host.app.session.value?.catalogue.value.prizes).toHaveLength(96);
    expect(host.app.matches.value).toHaveLength(2);
  });

  it('reports unavailable files, invalid names and invalid content', async () => {
    const platform = platformServing({ 'events/kaputt.json': '{"format":"other"}' });
    expect(await loadPreparedEvent(platform, { file: 'fehlt.json', name: 'X' })).toEqual({
      ok: false,
      error: { code: 'UNAVAILABLE' },
    });
    expect(await loadPreparedEvent(platform, { file: '../x.json', name: 'X' })).toEqual({
      ok: false,
      error: { code: 'INVALID_MANIFEST' },
    });
    expect(await loadPreparedEvent(platform, { file: 'kaputt.json', name: 'X' })).toEqual({
      ok: false,
      error: { code: 'IMPORT', error: { code: 'FOREIGN' } },
    });
  });
});
