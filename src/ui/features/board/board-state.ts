import { computed, type ReadonlySignal } from '@preact/signals';

export type CellState = 'OPEN' | 'DRAWN' | 'LATEST';

export interface BoardModel {
  readonly maxNumber: ReadonlySignal<number>;
  /** One computed signal per number: a draw re-renders only the cells whose state changed. */
  cell(number: number): ReadonlySignal<CellState>;
  readonly drawnCount: ReadonlySignal<number>;
}

/**
 * Board state derived from the drawn numbers and the latest one. Cells subscribe to their own
 * computed signal, so the board component itself never re-renders on a draw (§4).
 */
export function createBoardModel(
  drawn: ReadonlySignal<readonly number[]>,
  latest: ReadonlySignal<number | undefined>,
  maxNumber: ReadonlySignal<number>,
): BoardModel {
  const drawnSet = computed(() => new Set(drawn.value));
  const cells = new Map<number, ReadonlySignal<CellState>>();
  return {
    maxNumber,
    drawnCount: computed(() => drawnSet.value.size),
    cell(number) {
      let state = cells.get(number);
      if (state === undefined) {
        state = computed<CellState>(() => {
          if (!drawnSet.value.has(number)) return 'OPEN';
          return latest.value === number ? 'LATEST' : 'DRAWN';
        });
        cells.set(number, state);
      }
      return state;
    },
  };
}
