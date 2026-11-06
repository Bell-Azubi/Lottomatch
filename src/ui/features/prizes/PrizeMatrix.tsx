import { isAwarded, slotsForRound } from '../../../application/selectors';
import { prizeAt, type Catalogue } from '../../../domain/catalogue';
import { roundOf, type GameState } from '../../../domain/state';
import { SUPERLOTTO_SLOT } from '../../../domain/types';
import { commonText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { BadgeRing } from '../../design-system/BadgeRing';
import { Icon } from '../../design-system/Icon';
import styles from './PrizeMatrix.module.css';
import { prizesText } from './text';

export interface PrizeMatrixProps {
  readonly rounds: number;
  readonly catalogue: Catalogue;
  readonly game: GameState;
  readonly selected: number | undefined;
  readonly onSelect: (round: number) => void;
}

/** Rounds × prizes matrix: mini prize badges and a completeness ring per round (FR-8). */
export function PrizeMatrix({ rounds, catalogue, game, selected, onSelect }: PrizeMatrixProps) {
  const m = t(prizesText);
  const c = t(commonText);
  const list = Array.from({ length: rounds }, (_, index) => index + 1);
  return (
    <table class={styles.table}>
      <caption class={styles.caption}>{m.matrix.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{m.matrix.round}</th>
          <th scope="col">{m.matrix.prizes}</th>
          <th scope="col">{m.matrix.status}</th>
          <th scope="col">
            <span class="visually-hidden">{m.matrix.action}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {list.map((round) => {
          const slots = slotsForRound(roundOf(game, round), catalogue);
          const filled = slots.filter((slot) => prizeAt(catalogue, round, slot) !== undefined);
          const missing = slots.length - filled.length;
          return (
            <tr key={round} class={round === selected ? styles.selected : undefined}>
              <th scope="row" class={`${styles.round} tabular`}>
                {round}
              </th>
              <td>
                <ul class={styles.badges}>
                  {slots.map((slot) => {
                    const prize = prizeAt(catalogue, round, slot);
                    const awarded = isAwarded(game, round, slot);
                    const state = awarded
                      ? styles.awarded
                      : prize === undefined
                        ? styles.gap
                        : styles.filled;
                    const superlotto = slot === SUPERLOTTO_SLOT ? styles.superlotto : '';
                    return (
                      <li key={slot} class={`${styles.badge} ${state} ${superlotto}`}>
                        <span class={styles.disc} aria-hidden="true">
                          {c.prizeDisc(slot)}
                        </span>
                        <span class={styles.badgeText}>
                          <span class="visually-hidden">{c.prizeSlot(slot)}: </span>
                          {prize?.title ?? m.matrix.missing}
                          {awarded && <span class={styles.awardedTag}> · {m.matrix.awarded}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </td>
              <td>
                <span class={styles.status}>
                  <span class={styles.ring} aria-hidden="true">
                    <BadgeRing
                      variant="ring"
                      segments={slots.map((slot) =>
                        prizeAt(catalogue, round, slot) === undefined ? 'UPCOMING' : 'DONE',
                      )}
                    />
                  </span>
                  <span>
                    {m.matrix.complete(filled.length, slots.length)}
                    {missing > 0 && (
                      <span class={styles.warning}>
                        <Icon name="alert" size={16} /> {m.matrix.gaps(missing)}
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td>
                <button
                  type="button"
                  class={styles.edit}
                  aria-label={m.matrix.editRound(round)}
                  aria-pressed={round === selected}
                  onClick={() => {
                    onSelect(round);
                  }}
                >
                  {m.matrix.edit}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
