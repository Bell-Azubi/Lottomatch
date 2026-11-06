import { defaultSettings } from '../domain/settings';
import { PRIZE_SLOTS } from '../domain/types';

/** A prepared event file as it would lie in `public/events/`: 24 rounds, 96 prizes, no log. */
export const PREPARED_EVENT = JSON.stringify({
  format: 'lottomatch-live',
  schemaVersion: 1,
  match: { kind: 'REAL', settings: defaultSettings('Lottomatch 2026 (Beispiel)', '2026-11-21') },
  prizes: Array.from({ length: 24 }, (_, index) => index + 1).flatMap((round) =>
    PRIZE_SLOTS.map((slot) => ({
      id: `p${round}-${slot}`,
      round,
      slot,
      title: `Gang ${round}, Preis ${slot}`,
      winCondition: { kind: 'ONE_LINE' },
    })),
  ),
});
