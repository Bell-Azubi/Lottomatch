import { conditionFor, plannedSlots, prizeAt, type Catalogue } from '../../../domain/catalogue';
import type { MatchSettings } from '../../../domain/settings';
import { commonText } from '../../../i18n/catalogues';
import { formatCalendarDate, formatChf, formatDateTime } from '../../../i18n/format';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { Logo } from '../../design-system/Logo';
import styles from './PrintList.module.css';
import { prizesText } from './text';

export interface PrintListProps {
  readonly settings: MatchSettings;
  readonly catalogue: Catalogue;
  readonly printedAt: string;
}

/** Printable A4 prize list: badge top-left, Gold hairline rules, Night on white, no fills. */
export function PrintList({ settings, catalogue, printedAt }: PrintListProps) {
  const m = t(prizesText);
  const c = t(commonText);
  const rounds = Array.from({ length: settings.rounds }, (_, index) => index + 1);
  return (
    <section class={styles.print} hidden>
      <header class={styles.header}>
        <Logo size="print" />
        <div>
          <h1 class={styles.title}>{m.print.heading(settings.name)}</h1>
          <p class={styles.meta}>
            {[
              settings.date === '' ? undefined : formatCalendarDate(settings.date),
              settings.venue || undefined,
            ]
              .filter((part) => part !== undefined)
              .join(' · ')}
          </p>
          <p class={styles.meta}>{m.print.printedAt(formatDateTime(printedAt))}</p>
        </div>
      </header>
      {rounds.map((round) => (
        <section key={round} class={styles.round}>
          <h2 class={styles.roundTitle}>{m.print.round(round)}</h2>
          <table class={styles.table}>
            <tbody>
              {plannedSlots(catalogue, round).map((slot) => {
                const prize = prizeAt(catalogue, round, slot);
                const condition = conditionFor(catalogue, settings.template, round, slot);
                return (
                  <tr key={slot}>
                    <th scope="row" class={styles.slot}>
                      {c.prizeSlot(slot)}
                    </th>
                    <td>
                      <strong>{prizeTitle(prize?.title, slot, c)}</strong>
                      {prize?.description !== undefined && (
                        <span class={styles.description}> {prize.description}</span>
                      )}
                      {prize?.sponsor !== undefined && (
                        <span class={styles.sponsor}> {m.print.sponsor(prize.sponsor)}</span>
                      )}
                    </td>
                    <td class={styles.condition}>{conditionLabel(condition, c)}</td>
                    <td class={`${styles.value} tabular`}>
                      {prize?.valueChf === undefined ? '' : formatChf(prize.valueChf)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </section>
  );
}
