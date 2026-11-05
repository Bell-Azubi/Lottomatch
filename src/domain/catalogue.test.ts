import { describe, expect, it } from 'vitest';
import {
  applyTemplate,
  clearRound,
  conditionFor,
  copyRound,
  EMPTY_CATALOGUE,
  findGaps,
  prizeAt,
  prizeFromDraft,
  referencedImages,
  removePrize,
  roundCompleteness,
  snapshotOf,
  totalPrizeValue,
  upsertPrize,
  validatePrize,
  type PrizeDraft,
} from './catalogue';
import { DEFAULT_TEMPLATE } from './settings';
import type { Prize } from './types';

const draft: PrizeDraft = {
  title: '  Präsentkorb  ',
  description: 'Mit   Wein',
  valueChf: 50.5,
  sponsor: 'Bäckerei Muster',
  imageId: 'img1',
  winCondition: { kind: 'ONE_LINE' },
};

let counter = 0;
const newId = () => `id${(counter += 1)}`;
const prize = (round: number, slot: 1 | 2 | 3 | 4, extra: Partial<Prize> = {}): Prize => ({
  id: `p${round}-${slot}`,
  round,
  slot,
  title: `Preis ${slot}`,
  winCondition: DEFAULT_TEMPLATE[slot],
  ...extra,
});

describe('validatePrize', () => {
  it('accepts a full draft and cleans text', () => {
    expect(validatePrize(draft)).toEqual([]);
    expect(prizeFromDraft('p', 1, 2, draft)).toEqual({
      id: 'p',
      round: 1,
      slot: 2,
      title: 'Präsentkorb',
      description: 'Mit Wein',
      valueChf: 50.5,
      sponsor: 'Bäckerei Muster',
      imageId: 'img1',
      winCondition: { kind: 'ONE_LINE' },
    });
  });

  it('omits empty optional fields', () => {
    const minimal = {
      ...draft,
      description: ' ',
      sponsor: '',
      valueChf: undefined,
      imageId: undefined,
    };
    expect(Object.keys(prizeFromDraft('p', 1, 1, minimal))).toEqual([
      'id',
      'round',
      'slot',
      'title',
      'winCondition',
    ]);
    const custom = { ...draft, winCondition: { kind: 'CUSTOM' as const, label: '  Ecken ' } };
    expect(prizeFromDraft('p', 1, 1, custom).winCondition).toEqual({
      kind: 'CUSTOM',
      label: 'Ecken',
    });
  });

  it('reports each field issue', () => {
    const issues = validatePrize({
      title: ' ',
      description: 'd'.repeat(201),
      valueChf: -1,
      sponsor: 's'.repeat(61),
      imageId: undefined,
      winCondition: { kind: 'CUSTOM', label: '' },
    });
    expect(issues.map((i) => `${i.field}:${i.code}`)).toEqual([
      'title:REQUIRED',
      'description:TOO_LONG',
      'sponsor:TOO_LONG',
      'valueChf:INVALID',
      'winCondition:INVALID',
    ]);
    expect(validatePrize({ ...draft, title: '😀'.repeat(60) })).toEqual([]);
    expect(validatePrize({ ...draft, title: 'x'.repeat(61) })).toEqual([
      { field: 'title', code: 'TOO_LONG' },
    ]);
  });
});

describe('catalogue editing', () => {
  const catalogue = upsertPrize(
    upsertPrize(EMPTY_CATALOGUE, prize(2, 1)),
    prize(1, 3, { imageId: 'a' }),
  );

  it('keeps prizes sorted and replaces by position', () => {
    expect(catalogue.prizes.map((p) => `${p.round}-${p.slot}`)).toEqual(['1-3', '2-1']);
    const replaced = upsertPrize(catalogue, prize(2, 1, { title: 'Neu' }));
    expect(prizeAt(replaced, 2, 1)?.title).toBe('Neu');
    expect(replaced.prizes).toHaveLength(2);
    expect(removePrize(replaced, 2, 1).prizes).toHaveLength(1);
  });

  it('falls back to the template for gaps', () => {
    const custom = upsertPrize(catalogue, prize(1, 1, { winCondition: { kind: 'FULL_CARD' } }));
    expect(conditionFor(custom, DEFAULT_TEMPLATE, 1, 1)).toEqual({ kind: 'FULL_CARD' });
    expect(conditionFor(custom, DEFAULT_TEMPLATE, 1, 2)).toEqual({ kind: 'ONE_LINE' });
  });

  it('reports completeness and gaps', () => {
    expect(roundCompleteness(catalogue, 1)).toBe(1);
    expect(findGaps(catalogue, 2)).toEqual([
      { round: 1, slots: [1, 2, 4] },
      { round: 2, slots: [2, 3, 4] },
    ]);
  });

  it('snapshots awarded prizes', () => {
    expect(snapshotOf(undefined, { kind: 'ONE_LINE' })).toEqual({
      winCondition: { kind: 'ONE_LINE' },
    });
    expect(snapshotOf(prize(1, 1, { valueChf: 20, sponsor: 'S' }), { kind: 'TWO_LINES' })).toEqual({
      title: 'Preis 1',
      winCondition: { kind: 'TWO_LINES' },
      valueChf: 20,
      sponsor: 'S',
    });
  });

  it('copies a round, skipping locked targets and mirroring gaps', () => {
    const source = upsertPrize(upsertPrize(EMPTY_CATALOGUE, prize(1, 1)), prize(3, 2));
    const result = copyRound(
      source,
      1,
      [1, 2, 3],
      (round, slot) => round === 3 && slot === 2,
      newId,
    );
    expect(result.skipped).toEqual([{ round: 3, slot: 2 }]);
    expect(prizeAt(result.catalogue, 2, 1)?.title).toBe('Preis 1');
    expect(prizeAt(result.catalogue, 2, 1)?.id).not.toBe('p1-1');
    expect(prizeAt(result.catalogue, 3, 2)?.id).toBe('p3-2');
    expect(roundCompleteness(result.catalogue, 1)).toBe(1);
  });

  it('applies the template to unlocked prizes', () => {
    const source = upsertPrize(
      EMPTY_CATALOGUE,
      prize(1, 1, { winCondition: { kind: 'FULL_CARD' } }),
    );
    const both = upsertPrize(source, prize(2, 1, { winCondition: { kind: 'FULL_CARD' } }));
    const result = applyTemplate(both, DEFAULT_TEMPLATE, (round) => round === 2);
    expect(prizeAt(result.catalogue, 1, 1)?.winCondition).toEqual({ kind: 'ONE_LINE' });
    expect(prizeAt(result.catalogue, 2, 1)?.winCondition).toEqual({ kind: 'FULL_CARD' });
    expect(result.skipped).toEqual([{ round: 2, slot: 1 }]);
  });

  it('clears a round except locked prizes', () => {
    const source = upsertPrize(upsertPrize(EMPTY_CATALOGUE, prize(1, 1)), prize(1, 2));
    const result = clearRound(source, 1, (_round, slot) => slot === 2);
    expect(result.catalogue.prizes.map((p) => p.slot)).toEqual([2]);
    expect(result.skipped).toEqual([{ round: 1, slot: 2 }]);
  });

  it('totals values in Rappen and lists images', () => {
    const values = upsertPrize(
      upsertPrize(
        upsertPrize(EMPTY_CATALOGUE, prize(1, 1, { valueChf: 0.1 })),
        prize(1, 2, { valueChf: 0.2 }),
      ),
      prize(5, 1, { valueChf: 100, imageId: 'b' }),
    );
    expect(totalPrizeValue(values, 4)).toBe(0.3);
    expect(totalPrizeValue(values, 5)).toBe(100.3);
    expect([...referencedImages(upsertPrize(values, prize(2, 2, { imageId: 'b' })))]).toEqual([
      'b',
    ]);
  });
});
