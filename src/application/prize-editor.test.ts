import { describe, expect, it } from 'vitest';
import { prizeAt, type PrizeDraft } from '../domain/catalogue';
import { err } from '../domain/result';
import { createTestHost, type TestHost } from '../test/test-platform';
import { PrizeEditor } from './prize-editor';

const draft = (title: string, extra: Partial<PrizeDraft> = {}): PrizeDraft => ({
  title,
  description: '',
  valueChf: undefined,
  sponsor: '',
  imageId: undefined,
  winCondition: { kind: 'ONE_LINE' },
  ...extra,
});

async function setup(): Promise<TestHost & { editor: PrizeEditor }> {
  const host = await createTestHost();
  return { ...host, editor: new PrizeEditor(host.app) };
}

function catalogueOf(host: TestHost) {
  const session = host.app.session.value;
  if (session === undefined) throw new Error('no session');
  return session.catalogue.value;
}

describe('PrizeEditor: single prizes', () => {
  it('saves, replaces and removes a prize', async () => {
    const host = await setup();
    const saved = host.editor.savePrize(1, 2, draft('  Präsentkorb ', { valueChf: 50 }));
    expect(saved.ok && saved.value).toMatchObject({
      round: 1,
      slot: 2,
      title: 'Präsentkorb',
      valueChf: 50,
    });
    const id = prizeAt(catalogueOf(host), 1, 2)?.id;
    host.editor.savePrize(1, 2, draft('Weinkiste'));
    expect(prizeAt(catalogueOf(host), 1, 2)).toMatchObject({ id, title: 'Weinkiste' });
    expect(host.editor.removePrize(1, 2).ok).toBe(true);
    expect(prizeAt(catalogueOf(host), 1, 2)).toBeUndefined();
    expect(host.editor.removePrize(1, 2).ok).toBe(true);
  });

  it('validates drafts and rounds', async () => {
    const host = await setup();
    const invalid = host.editor.savePrize(1, 1, draft(' '));
    expect(!invalid.ok && invalid.error).toEqual({
      code: 'INVALID',
      issues: [{ field: 'title', code: 'REQUIRED' }],
    });
    expect(host.editor.savePrize(25, 1, draft('A'))).toEqual(err({ code: 'OUT_OF_RANGE' }));
    expect(host.editor.clearRound(0)).toEqual(err({ code: 'OUT_OF_RANGE' }));
    expect(host.editor.copyRound(1, [1, 30])).toEqual(err({ code: 'OUT_OF_RANGE' }));
  });

  it('keeps awarded prizes read-only', async () => {
    const host = await setup();
    host.editor.savePrize(1, 1, draft('Zopf'));
    host.host.startRound();
    host.host.award({ winners: [{ cardNo: '7' }] });
    expect(host.editor.savePrize(1, 1, draft('Neu'))).toEqual(err({ code: 'LOCKED' }));
    expect(host.editor.removePrize(1, 1)).toEqual(err({ code: 'LOCKED' }));
    const cleared = host.editor.clearRound(1);
    expect(cleared.ok && cleared.value.skipped).toEqual([{ round: 1, slot: 1 }]);
    expect(prizeAt(catalogueOf(host), 1, 1)?.title).toBe('Zopf');
  });

  it('refuses changes in a read-only window and without an event', async () => {
    const host = await setup();
    host.app.setWriteGuard(() => false);
    expect(host.editor.savePrize(1, 1, draft('A'))).toEqual(err({ code: 'READ_ONLY' }));
    expect(await host.editor.storeImage(new Blob(['x']))).toEqual(err('READ_ONLY'));
    host.app.session.value = undefined;
    expect(host.editor.removePrize(1, 1)).toEqual(err({ code: 'NO_EVENT' }));
  });
});

describe('PrizeEditor: bulk tools and import', () => {
  it('copies a round, applies the template and clears a round', async () => {
    const host = await setup();
    host.editor.savePrize(1, 1, draft('Zopf', { winCondition: { kind: 'FULL_CARD' } }));
    host.editor.savePrize(1, 4, draft('Velo'));
    const copied = host.editor.copyRound(1, [2, 3, 1]);
    expect(copied.ok && copied.value.skipped).toEqual([]);
    expect(prizeAt(catalogueOf(host), 3, 4)?.title).toBe('Velo');
    const templated = host.editor.applyTemplateEverywhere();
    expect(templated.ok).toBe(true);
    expect(prizeAt(catalogueOf(host), 2, 1)?.winCondition).toEqual({ kind: 'ONE_LINE' });
    expect(prizeAt(catalogueOf(host), 2, 4)?.winCondition).toEqual({ kind: 'FULL_CARD' });
    expect(host.editor.clearRound(2).ok).toBe(true);
    expect(catalogueOf(host).prizes.filter((p) => p.round === 2)).toEqual([]);
  });

  it('imports valid rows and skips locked, invalid and unknown rounds', async () => {
    const host = await setup();
    host.host.startRound();
    host.host.award({ winners: [{}] });
    const result = host.editor.importPrizes([
      { round: 1, slot: 1, draft: draft('Gesperrt') },
      { round: 1, slot: 2, draft: draft('Kinogutschein') },
      { round: 99, slot: 1, draft: draft('Zu weit') },
      { round: 2, slot: 1, draft: draft('') },
    ]);
    expect(result.ok && result.value).toEqual({ imported: 1, skipped: 3 });
    expect(prizeAt(catalogueOf(host), 1, 2)?.title).toBe('Kinogutschein');
    const none = host.editor.importPrizes([]);
    expect(none.ok && none.value).toEqual({ imported: 0, skipped: 0 });
  });

  it('audits catalogue changes once the event has started', async () => {
    const host = await setup();
    host.host.startRound();
    host.editor.savePrize(2, 1, draft('Zopf'));
    const last = host.app.session.value?.log.at(-1)?.event;
    expect(last).toEqual({ type: 'PRIZES_CHANGED', action: 'PRIZE_SAVED', rounds: [2] });
  });
});

describe('PrizeEditor: images', () => {
  it('stores processed images and reports processor errors', async () => {
    const host = await setup();
    const stored = await host.editor.storeImage(new Blob(['png'], { type: 'image/png' }));
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(await host.platform.images.get(stored.value)).toMatchObject({ width: 64, height: 48 });
    const failing = await createTestHost({
      imageProcessor: { process: () => Promise.resolve(err('SVG_REJECTED')) },
    });
    expect(await new PrizeEditor(failing.app).storeImage(new Blob(['<svg/>']))).toEqual(
      err('SVG_REJECTED'),
    );
  });

  it('collects unreferenced images but keeps pending and referenced ones', async () => {
    const host = await setup();
    const kept = await host.editor.storeImage(new Blob(['a']));
    const pending = await host.editor.storeImage(new Blob(['b']));
    if (!kept.ok || !pending.ok) throw new Error('upload failed');
    host.editor.savePrize(1, 1, draft('Mit Bild', { imageId: kept.value }));
    await host.app.queue.flush();
    await host.platform.images.put({
      id: 'orphan',
      blob: new Blob(['c']),
      width: 1,
      height: 1,
      createdAt: '',
    });
    expect(await host.editor.collectGarbage()).toBe(1);
    expect(await host.platform.images.listIds()).toEqual([kept.value, pending.value]);
    host.editor.releaseImage(pending.value);
    await host.app.queue.flush();
    await host.editor.collectGarbage();
    expect(await host.platform.images.listIds()).toEqual([kept.value]);
    host.editor.removePrize(1, 1);
    await host.app.queue.flush();
    expect(await host.editor.collectGarbage()).toBe(0);
    expect(await host.platform.images.listIds()).toEqual([]);
  });

  it('keeps images referenced by other events and everything when a catalogue is unreadable', async () => {
    const host = await setup();
    const other = await host.admin.duplicate(host.app.session.value?.matchId ?? '', 'Kopie');
    if (!other.ok) throw new Error('duplicate failed');
    await host.platform.documents.putCatalogue({
      matchId: other.value.id,
      version: 1,
      prizes: [
        {
          id: 'p',
          round: 1,
          slot: 1,
          title: 'Fremd',
          imageId: 'shared',
          winCondition: { kind: 'ONE_LINE' },
        },
      ],
    });
    await host.platform.images.put({
      id: 'shared',
      blob: new Blob(['s']),
      width: 1,
      height: 1,
      createdAt: '',
    });
    expect(await host.editor.collectGarbage()).toBe(0);
    await host.platform.images.put({
      id: 'orphan',
      blob: new Blob(['o']),
      width: 1,
      height: 1,
      createdAt: '',
    });
    await host.platform.documents.putCatalogue({
      matchId: other.value.id,
      version: 2,
      prizes: 'kaputt',
    } as never);
    expect(await host.editor.collectGarbage()).toBe(0);
    expect(await host.platform.images.listIds()).toContain('orphan');
  });
});
