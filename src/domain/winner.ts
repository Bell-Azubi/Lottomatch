import { cleanText } from './limits';
import type { Winner } from './types';

/** Raw winner details as typed into the confirmation form. */
export interface WinnerInput {
  readonly cardNo?: string | undefined;
  readonly name?: string | undefined;
  readonly note?: string | undefined;
  readonly validSinceSeq?: number | undefined;
}

function cleaned(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = cleanText(value);
  return text === '' ? undefined : text;
}

/** Trims every field and drops empty ones, so stored winners never hold blank strings. */
export function normaliseWinner(input: WinnerInput): Winner {
  const cardNo = cleaned(input.cardNo);
  const name = cleaned(input.name);
  const note = cleaned(input.note);
  return {
    ...(cardNo === undefined ? {} : { cardNo }),
    ...(name === undefined ? {} : { name }),
    ...(note === undefined ? {} : { note }),
    ...(input.validSinceSeq === undefined ? {} : { validSinceSeq: input.validSinceSeq }),
  };
}

/** True when the winner carries personal data (name or note). */
export function hasPersonalData(winner: Winner): boolean {
  return winner.name !== undefined || winner.note !== undefined;
}

/** Removes personal data (C6) while keeping the card number and claim reference. */
export function redactWinner(winner: Winner): Winner {
  const { name: _name, note: _note, ...rest } = winner;
  return rest;
}
