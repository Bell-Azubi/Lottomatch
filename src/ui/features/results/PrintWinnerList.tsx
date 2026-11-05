import type { RoundSummary } from '../../../application/results';
import type { MatchSettings } from '../../../domain/settings';
import { commonText } from '../../../i18n/catalogues';
import { formatCalendarDate, formatDateTime } from '../../../i18n/format';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { Logo } from '../../design-system/Logo';
import styles from './PrintWinnerList.module.css';
import { resultsText } from './text';

export interface PrintWinnerListProps {
  readonly rounds: readonly RoundSummary[];
  readonly settings: MatchSettings;
  readonly printedAt: string;
}

/**
 * A4 winner list for the Gabentisch (print only): badge top-left, Gold hairline rules, Night text
 * on white, a box to tick per prize; legible in black and white.
 */
export function PrintWinnerList({ rounds, settings, printedAt }: PrintWinnerListProps) {
  const m = t(resultsText);
  const c = t(commonText);
  const withWinners = rounds.filter((round) =>
    round.prizes.some((prize) => prize.status === 'AWARDED'),
  );
  const date = settings.date === '' ? '' : formatCalendarDate(settings.date);
  return (
    <section class={styles.print}>
      <header class={styles.header}>
        <Logo size="print" />
        <div>
          <h2 class={styles.title}>{m.print.title}</h2>
          <p class={styles.subtitle}>{m.eventLine(settings.name, date)}</p>
        </div>
      </header>
      {withWinners.length === 0 && <p>{m.print.empty}</p>}
      {withWinners.map((round) => (
        <section key={round.round} class={styles.round}>
          <h3 class={styles.roundTitle}>{m.print.roundTitle(round.round)}</h3>
          <table class={styles.table}>
            <thead>
              <tr>
                <th scope="col">{m.table.prize}</th>
                <th scope="col">{m.table.condition}</th>
                <th scope="col">{m.table.winners}</th>
                <th scope="col">{m.print.collected}</th>
              </tr>
            </thead>
            <tbody>
              {round.prizes
                .filter((prize) => prize.status === 'AWARDED')
                .flatMap((prize) =>
                  prize.winners.map((winner, index) => (
                    <tr key={`${prize.slot}-${index}`}>
                      <th scope="row">
                        {c.prizeSlot(prize.slot)}: {prizeTitle(prize.title, prize.slot, c)}
                      </th>
                      <td>{conditionLabel(prize.condition, c)}</td>
                      <td>
                        {winner.cardNo === undefined ? m.prize.noCard : m.prize.card(winner.cardNo)}
                        {winner.name === undefined ? '' : ` · ${winner.name}`}
                      </td>
                      <td>
                        {prize.handout === 'COLLECTED' ? (
                          m.handout.COLLECTED
                        ) : (
                          <span class={styles.box} role="img" aria-label={m.handout.OPEN} />
                        )}
                      </td>
                    </tr>
                  )),
                )}
            </tbody>
          </table>
        </section>
      ))}
      <p class={styles.footer}>{m.print.printedAt(formatDateTime(printedAt))}</p>
    </section>
  );
}
