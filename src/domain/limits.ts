/** Field limits shared by validation, forms and import. */
export const LIMITS = {
  title: 60,
  description: 200,
  sponsor: 60,
  customRule: 60,
  cardNo: 20,
  winnerName: 80,
  winnerNote: 200,
  reason: 200,
  matchName: 80,
  venue: 80,
  pauseMessage: 120,
  sponsors: 20,
  maxWinners: 20,
  rounds: { min: 1, max: 50 },
  maxNumber: { min: 30, max: 99 },
  perLine: { min: 3, max: 9 },
  lines: { min: 2, max: 6 },
  valueChf: { max: 1_000_000 },
  payoutRatio: { min: 1, max: 100 },
  stakesChf: { max: 10_000_000 },
} as const;

/** Inclusive integer range check. */
export function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** Trims and collapses inner whitespace; used for every free-text field before validation. */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
