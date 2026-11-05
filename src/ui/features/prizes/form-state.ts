import { validatePrize, type PrizeDraft } from '../../../domain/catalogue';
import { parseChf } from '../../../domain/money';
import type { Prize, WinCondition, WinConditionKind } from '../../../domain/types';
import type { PrizesMessages } from '../../../i18n/de-CH/prizes';

/** Raw values of one prize form, as typed. */
export interface PrizeFormValues {
  readonly title: string;
  readonly description: string;
  readonly valueText: string;
  readonly sponsor: string;
  readonly imageId: string | undefined;
  readonly conditionKind: WinConditionKind;
  readonly customLabel: string;
}

export interface PrizeFormErrors {
  readonly title?: string;
  readonly description?: string;
  readonly value?: string;
  readonly sponsor?: string;
  readonly customLabel?: string;
}

/** `50` stays `50`, `50.5` becomes `50.50`. */
export function valueText(value: number | undefined): string {
  if (value === undefined) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Form values of a stored prize, or an empty form using the slot's template condition. */
export function formValues(prize: Prize | undefined, fallback: WinCondition): PrizeFormValues {
  const condition = prize?.winCondition ?? fallback;
  return {
    title: prize?.title ?? '',
    description: prize?.description ?? '',
    valueText: valueText(prize?.valueChf),
    sponsor: prize?.sponsor ?? '',
    imageId: prize?.imageId,
    conditionKind: condition.kind,
    customLabel: condition.kind === 'CUSTOM' ? condition.label : '',
  };
}

/** True when two value sets are identical (dirty check). */
export function sameValues(a: PrizeFormValues, b: PrizeFormValues): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.valueText === b.valueText &&
    a.sponsor === b.sponsor &&
    a.imageId === b.imageId &&
    a.conditionKind === b.conditionKind &&
    a.customLabel === b.customLabel
  );
}

function conditionOf(values: PrizeFormValues): WinCondition {
  return values.conditionKind === 'CUSTOM'
    ? { kind: 'CUSTOM', label: values.customLabel }
    : { kind: values.conditionKind };
}

/** Validates the form; returns a draft or field errors with their messages. */
export function draftFromValues(
  values: PrizeFormValues,
  m: PrizesMessages,
): { readonly draft: PrizeDraft } | { readonly errors: PrizeFormErrors } {
  const value = parseChf(values.valueText);
  const draft: PrizeDraft = {
    title: values.title,
    description: values.description,
    valueChf: value.ok ? value.value : undefined,
    sponsor: values.sponsor,
    imageId: values.imageId,
    winCondition: conditionOf(values),
  };
  const errors: { -readonly [K in keyof PrizeFormErrors]: PrizeFormErrors[K] } = {};
  if (!value.ok) errors.value = m.form.errors.value[value.error];
  for (const issue of validatePrize(draft)) {
    if (issue.field === 'title') {
      errors.title =
        issue.code === 'REQUIRED' ? m.form.errors.titleRequired : m.form.errors.titleTooLong;
    } else if (issue.field === 'description') {
      errors.description = m.form.errors.descriptionTooLong;
    } else if (issue.field === 'sponsor') {
      errors.sponsor = m.form.errors.sponsorTooLong;
    } else if (issue.field === 'winCondition') {
      errors.customLabel = m.form.errors.customLabel;
    } else {
      errors.value = m.form.errors.value.INVALID;
    }
  }
  return Object.keys(errors).length === 0 ? { draft } : { errors };
}

/** Parses "2-5, 8" into sorted, unique rounds within 1–max; `undefined` when malformed. */
export function parseRoundList(text: string, max: number): number[] | undefined {
  const parts = text
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (parts.length === 0) return undefined;
  const rounds = new Set<number>();
  for (const part of parts) {
    const match = /^(\d{1,2})(?:[-–](\d{1,2}))?$/.exec(part);
    if (match === null) return undefined;
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < 1 || end > max || end < start) return undefined;
    for (let round = start; round <= end; round += 1) rounds.add(round);
  }
  return [...rounds].sort((a, b) => a - b);
}
