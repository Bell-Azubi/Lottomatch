import { describe, expect, it } from 'vitest';
import { prizes as m } from '../../../i18n/de-CH/prizes';
import { draftFromValues, formValues, parseRoundList, sameValues, valueText } from './form-state';

describe('form values', () => {
  it('derives values from a prize or the template', () => {
    expect(formValues(undefined, { kind: 'TWO_LINES' })).toEqual({
      title: '',
      description: '',
      valueText: '',
      sponsor: '',
      imageId: undefined,
      conditionKind: 'TWO_LINES',
      customLabel: '',
    });
    const values = formValues(
      {
        id: 'p',
        round: 1,
        slot: 1,
        title: 'Velo',
        valueChf: 50.5,
        sponsor: 'S',
        imageId: 'i',
        winCondition: { kind: 'CUSTOM', label: 'Ecken' },
      },
      { kind: 'ONE_LINE' },
    );
    expect(values).toMatchObject({
      valueText: '50.50',
      conditionKind: 'CUSTOM',
      customLabel: 'Ecken',
      imageId: 'i',
    });
    expect(sameValues(values, { ...values })).toBe(true);
    expect(sameValues(values, { ...values, title: 'x' })).toBe(false);
    expect(valueText(40)).toBe('40');
  });

  it('builds a draft from valid values', () => {
    const values = {
      ...formValues(undefined, { kind: 'ONE_LINE' }),
      title: 'Velo',
      valueText: "1'000.50",
    };
    expect(draftFromValues(values, m)).toEqual({
      draft: {
        title: 'Velo',
        description: '',
        valueChf: 1000.5,
        sponsor: '',
        imageId: undefined,
        winCondition: { kind: 'ONE_LINE' },
      },
    });
  });

  it('maps every invalid field to its message', () => {
    const values = {
      ...formValues(undefined, { kind: 'ONE_LINE' }),
      title: '',
      description: 'd'.repeat(201),
      sponsor: 's'.repeat(61),
      valueText: '5.123',
      conditionKind: 'CUSTOM' as const,
      customLabel: '',
    };
    expect(draftFromValues(values, m)).toEqual({
      errors: {
        title: m.form.errors.titleRequired,
        description: m.form.errors.descriptionTooLong,
        sponsor: m.form.errors.sponsorTooLong,
        value: m.form.errors.value.TOO_MANY_DECIMALS,
        customLabel: m.form.errors.customLabel,
      },
    });
    const tooLong = draftFromValues(
      { ...formValues(undefined, { kind: 'ONE_LINE' }), title: 't'.repeat(61) },
      m,
    );
    expect(tooLong).toEqual({ errors: { title: m.form.errors.titleTooLong } });
    const tooLarge = draftFromValues(
      { ...formValues(undefined, { kind: 'ONE_LINE' }), title: 'A', valueText: '2000000' },
      m,
    );
    expect(tooLarge).toEqual({ errors: { value: m.form.errors.value.TOO_LARGE } });
  });
});

describe('parseRoundList', () => {
  it('parses ranges and lists', () => {
    expect(parseRoundList('2-5, 8', 24)).toEqual([2, 3, 4, 5, 8]);
    expect(parseRoundList('8;3 3', 24)).toEqual([3, 8]);
    expect(parseRoundList('1–2', 24)).toEqual([1, 2]);
  });

  it.each(['', 'a', '5-2', '0', '25', '1-30', '1-'])('rejects %j', (text) => {
    expect(parseRoundList(text, 24)).toBeUndefined();
  });
});
