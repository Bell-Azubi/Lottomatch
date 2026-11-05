import { roundOf, type GameState, type RoundStatus } from './state';

export type RingSegment = 'DONE' | 'CURRENT' | 'UPCOMING' | 'ABORTED';

/** Status of a round; untouched rounds are upcoming. */
export function roundStatus(state: GameState, round: number): RoundStatus {
  return roundOf(state, round).status;
}

/**
 * The round "Runde starten" begins: the lowest upcoming round from the current one on,
 * else the lowest upcoming round overall; `undefined` when every round has been played.
 */
export function nextRound(state: GameState, totalRounds: number): number | undefined {
  const from = Math.max(1, state.currentRound ?? 1);
  for (let round = from; round <= totalRounds; round += 1) {
    if (roundStatus(state, round) === 'UPCOMING') return round;
  }
  for (let round = 1; round < Math.min(from, totalRounds + 1); round += 1) {
    if (roundStatus(state, round) === 'UPCOMING') return round;
  }
  return undefined;
}

/** One segment per round for the round ring. */
export function roundRing(state: GameState, totalRounds: number): RingSegment[] {
  return Array.from({ length: totalRounds }, (_, index) => {
    const round = index + 1;
    if (state.phase === 'ROUND_RUNNING' && state.currentRound === round) return 'CURRENT';
    switch (roundStatus(state, round)) {
      case 'COMPLETED':
        return 'DONE';
      case 'ABORTED':
        return 'ABORTED';
      case 'RUNNING':
        return 'CURRENT';
      case 'UPCOMING':
        return 'UPCOMING';
    }
  });
}

/** Rounds that are neither completed nor running. */
export function unplayedRounds(state: GameState, totalRounds: number): number[] {
  const rounds: number[] = [];
  for (let round = 1; round <= totalRounds; round += 1) {
    const status = roundStatus(state, round);
    if (status === 'UPCOMING' || status === 'ABORTED') rounds.push(round);
  }
  return rounds;
}

/** Number of completed rounds. */
export function completedRoundCount(state: GameState): number {
  let count = 0;
  for (const round of state.rounds.values()) if (round.status === 'COMPLETED') count += 1;
  return count;
}
