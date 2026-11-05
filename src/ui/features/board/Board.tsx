import type { ReadonlySignal } from '@preact/signals';
import { Component } from 'preact';
import { liveText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import type { BoardModel, CellState } from './board-state';
import styles from './Board.module.css';

const COLUMNS = 10;

interface CellProps {
  readonly number: number;
  readonly state: ReadonlySignal<CellState>;
  readonly pick: ((number: number) => void) | undefined;
}

function cellLabel(number: number, state: CellState): string {
  const m = t(liveText).board;
  if (state === 'OPEN') return m.cellOpen(number);
  return state === 'LATEST' ? m.cellLatest(number) : m.cellDrawn(number);
}

/** One disc: open (Graphite outline, Ash numeral), drawn (Gold), latest (Gold + Red ring, pulse). */
function Cell({ number, state, pick }: CellProps) {
  const value = state.value;
  const className = `${styles.cell} ${styles[`cell${value}`]}`;
  const numeral = (
    <span class={styles.numeral} aria-hidden="true">
      {number}
    </span>
  );
  if (pick === undefined) {
    return (
      <span
        class={className}
        data-number={number}
        role="gridcell"
        aria-label={cellLabel(number, value)}
      >
        {numeral}
      </span>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-number={number}
      role="gridcell"
      aria-label={cellLabel(number, value)}
      aria-disabled={value === 'OPEN' ? undefined : true}
      tabIndex={number === 1 ? 0 : -1}
      onClick={() => {
        if (value === 'OPEN') pick(number);
      }}
    >
      {numeral}
    </button>
  );
}

const DELTAS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: COLUMNS,
  ArrowUp: -COLUMNS,
};

/** Roving tab stop: arrow keys, Home and End move focus between numbers. */
function moveFocus(grid: HTMLElement, from: HTMLElement, key: string, max: number): boolean {
  const current = Number(from.dataset['number']);
  if (!Number.isInteger(current)) return false;
  const delta = DELTAS[key];
  const target =
    key === 'Home' ? 1 : key === 'End' ? max : delta === undefined ? undefined : current + delta;
  if (target === undefined) return false;
  const next =
    target >= 1 && target <= max
      ? grid.querySelector<HTMLElement>(`[data-number="${target}"]`)
      : null;
  if (next !== null) {
    from.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }
  return true;
}

export interface BoardProps {
  readonly model: BoardModel;
  /** Host: cells are buttons that ask to confirm a manual draw. */
  readonly onPick?: (number: number) => void;
  readonly size?: 'host' | 'display';
}

/**
 * Lottoraster 1–N, ten per row, ascending, with faint alternating column bands (FR-1).
 * The board renders once; each cell subscribes to its own signal, so a draw re-renders only the
 * cells whose state changed, never the board.
 */
export class Board extends Component<BoardProps> {
  private grid: HTMLDivElement | null = null;

  private readonly pick = (number: number): void => {
    this.props.onPick?.(number);
  };

  override shouldComponentUpdate(next: BoardProps): boolean {
    return (
      next.model !== this.props.model ||
      next.size !== this.props.size ||
      (next.onPick === undefined) !== (this.props.onPick === undefined)
    );
  }

  override render() {
    const { model, size = 'host', onPick } = this.props;
    const max = model.maxNumber.value;
    const rows = Math.ceil(max / COLUMNS);
    const pick = onPick === undefined ? undefined : this.pick;
    return (
      <div
        ref={(element) => {
          this.grid = element;
        }}
        class={`${styles.board} ${size === 'display' ? styles.display : styles.host}`}
        role="grid"
        aria-label={t(liveText).board.label}
        aria-rowcount={rows}
        aria-colcount={COLUMNS}
        onKeyDown={(event) => {
          const target = event.target;
          if (pick === undefined || !(target instanceof HTMLElement) || this.grid === null) return;
          if (moveFocus(this.grid, target, event.key, max)) event.preventDefault();
        }}
      >
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} class={styles.row} role="row">
            {Array.from({ length: Math.min(COLUMNS, max - row * COLUMNS) }, (_, column) => {
              const number = row * COLUMNS + column + 1;
              return <Cell key={number} number={number} state={model.cell(number)} pick={pick} />;
            })}
          </div>
        ))}
      </div>
    );
  }
}
