import { describe, expect, it } from 'vitest';
import { webCrypto } from '../infrastructure/crypto';
import { loadPreparedEvent, MANIFEST_PATH, parseManifest } from './prepared-events';

/**
 * Every prepared event file in the public repository (README: "Shipping a prepared event
 * file"): listed in the manifest, valid as an import, and free of anything personal.
 */
const shipped = import.meta.glob<string>('../../public/events/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const byName = new Map(
  Object.entries(shipped).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text]),
);
const manifestName = MANIFEST_PATH.slice(MANIFEST_PATH.lastIndexOf('/') + 1);
const eventFiles = [...byName.keys()].filter((name) => name !== manifestName);

function serve(name: string) {
  return {
    crypto: webCrypto,
    fetchText: (path: string) => {
      const text = byName.get(path.slice(path.lastIndexOf('/') + 1));
      return path === `events/${name}` && text !== undefined
        ? Promise.resolve(text)
        : Promise.reject(new Error(`404 ${path}`));
    },
  };
}

describe('prepared event files shipped in public/events', () => {
  const manifest = parseManifest(byName.get(manifestName) ?? '');

  it('has a valid manifest that lists exactly the files present', () => {
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) return;
    const listed = manifest.value.map((entry) => entry.file);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...eventFiles].sort());
  });

  it.each(eventFiles)('%s imports cleanly and carries no personal data', async (name) => {
    const raw = JSON.parse(byName.get(name) ?? 'null') as Record<string, unknown> | null;
    expect(raw).not.toBeNull();
    expect(raw).not.toHaveProperty('log');
    expect(raw).not.toHaveProperty('images');
    expect(raw).not.toHaveProperty('checksum');
    const prizes = (raw?.['prizes'] ?? []) as readonly Record<string, unknown>[];
    expect(prizes.filter((prize) => 'imageId' in prize)).toEqual([]);
    const preview = await loadPreparedEvent(serve(name), { file: name, name });
    expect(preview).toMatchObject({
      ok: true,
      value: { logEntries: 0, awards: 0, images: 0, checksum: 'ABSENT' },
    });
  });
});
