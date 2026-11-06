import { displayText } from '../../../i18n/catalogues';
import { formatCalendarDate } from '../../../i18n/format';
import { t } from '../../../i18n';
import { BadgeRing } from '../../design-system/BadgeRing';
import { Logo } from '../../design-system/Logo';
import pageStyles from './DisplayPage.module.css';
import styles from './Welcome.module.css';

export interface WelcomeProps {
  readonly date: string | undefined;
  readonly venue: string | undefined;
  readonly practice: boolean;
}

/**
 * Start page of the display until the first round starts: a badge where the drawn numbers appear
 * later, the club's own badge and the greeting with the event's date and venue.
 */
export function Welcome({ date, venue, practice }: WelcomeProps) {
  const m = t(displayText);
  const details = [date === undefined ? undefined : formatCalendarDate(date), venue]
    .filter((part) => part !== undefined)
    .join(' · ');
  return (
    <section class={styles.welcome} aria-label={m.welcome.greeting}>
      <div class={styles.glow} aria-hidden="true" />
      {practice && (
        <span class={`${pageStyles.practice} ${styles.practice}`}>{m.ringPractice}</span>
      )}
      <div class={styles.badge} aria-hidden="true">
        <BadgeRing
          topText={practice ? m.ringPractice : m.welcome.ringTop}
          bottomText={m.welcome.ringBottom}
        >
          <span class={styles.mark}>
            {m.welcome.mark.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </BadgeRing>
      </div>
      <div class={styles.text}>
        <Logo size="welcome" />
        <p class={styles.headline}>{m.welcome.greeting}</p>
        <p class={styles.event}>
          {m.welcome.event} <span class={styles.club}>{m.welcome.club}</span>
        </p>
        {details !== '' && <p class={`${styles.details} tabular`}>{details}</p>}
        <p class={styles.luck}>{m.welcome.luck}</p>
      </div>
    </section>
  );
}
