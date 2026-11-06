import type { Prize, PrizeSlot } from '../domain/types';
import { SUPERLOTTO_SLOT } from '../domain/types';

/** One round of the list: the 1. to 4. Preis, then the Superlotto where the round has one. */
type ListedRound = readonly [string, string, string, string, string?];

/** The prize list of the event (Excel sheet «Preise»), starting with round 1. */
const LISTED_ROUNDS: readonly ListedRound[] = [
  ['1/2 Seite Speck', 'Teigwarentasche', 'Salami klein', 'Zopf'],
  ['Fleisch Chörbli', 'Gemüsekorb', 'Honig', 'Specktranche'],
  ['Früchtekorb klein', 'Fricktal Chörbli', 'Rollschinken', 'Süssmost'],
  ['Vorderschinken', '1/2 Schüfeli', 'Rippli', 'Wein', 'Grosser Früchtekorb'],
  ['Fleisch Chörbli', 'Teigwarentasche', 'Salami gross', 'Specktranche'],
  ['1/2 Seite Speck', 'Gemüsekorb', 'Schoggi Box', 'Honig'],
  ['Früchtekorb klein', 'Fricktal Chörbli', 'Salami gross', 'Süssmost'],
  ['Fleisch Chörbli', 'Teigwarentasche', 'Rippli', 'Specktranche'],
  ['1/2 Seite Speck', 'Rollschinken', 'Honig', 'Wein', 'Grosser Früchtekorb'],
  ['Früchtekorb klein', 'Salami gross', 'Schoggi Box', 'Süssmost'],
  ['Fleisch Chörbli', 'Teigwarentasche', 'Rippli', 'Salami klein'],
  ['1/2 Seite Speck', 'Gemüsekorb', 'Rollschinken', 'Zopf'],
  ['Früchtekorb klein', 'Fricktal Chörbli', 'Salami gross', 'Süssmost'],
  ['Vorderschinken', '1/2 Schüfeli', 'Honig', 'Specktranche', 'Grosser Früchtekorb'],
  ['Fleisch Chörbli', 'Gemüsekorb', 'Rippli', 'Wein'],
  ['1/2 Seite Speck', 'Fricktal Chörbli', 'Rollschinken', 'Schoggi Box'],
  ['Früchtekorb klein', 'Teigwarentasche', 'Salami gross', 'Süssmost'],
  ['Fleisch Chörbli', 'Gemüsekorb', 'Honig', 'Specktranche'],
  ['Vorderschinken', '1/2 Schüfeli', 'Salami klein', 'Wein', 'Grosser Früchtekorb'],
  ['Früchtekorb klein', 'Rollschinken', 'Rippli', 'Süssmost'],
  ['1/2 Seite Speck', 'Gemüsekorb', 'Salami gross', 'Zopf'],
  ['Fleisch Chörbli', 'Fricktal Chörbli', 'Schoggi Box', 'Honig'],
  ['Früchtekorb klein', 'Teigwarentasche', 'Rippli', 'Salami klein'],
  ['1/2 Seite Speck', 'Rollschinken', 'Salami gross', 'Süssmost', 'Grosser Früchtekorb'],
];

const listed = (round: number, slot: PrizeSlot, title: string): Prize => ({
  id: `list-${round}-${slot}`,
  round,
  slot,
  title,
  winCondition: slot === SUPERLOTTO_SLOT ? { kind: 'FULL_CARD' } : { kind: 'ONE_LINE' },
});

/** The list as prizes: 1 Reihe for the four prizes, Volle Karte for the Superlotto (ADR-0028). */
export const EVENT_PRIZE_LIST: readonly Prize[] = LISTED_ROUNDS.flatMap(
  ([first, second, third, fourth, superlotto], index) => {
    const round = index + 1;
    const prizes = [
      listed(round, 1, first),
      listed(round, 2, second),
      listed(round, 3, third),
      listed(round, 4, fourth),
    ];
    return superlotto === undefined
      ? prizes
      : [...prizes, listed(round, SUPERLOTTO_SLOT, superlotto)];
  },
);
