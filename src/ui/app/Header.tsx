import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { Icon } from '../design-system/Icon';
import { Logo } from '../design-system/Logo';
import { Glass } from '../design-system/Surface';
import { useServices } from './context';
import styles from './Header.module.css';
import { currentRoute, href, type Route } from './router';

const NAV: readonly Exclude<Route, 'display'>[] = [
  'start',
  'host',
  'prizes',
  'results',
  'settings',
];

/** Glass header: logo top-left, navigation, practice badge, save status and mute. */
export function Header() {
  const m = t(commonText);
  const { app } = useServices();
  const route = currentRoute.value;
  const session = app.session.value;
  const practice = session?.match.value.kind === 'PRACTICE';
  const status = app.queue.status.value;
  const muted = app.prefs.value.muted;
  return (
    <Glass as="header" className={`${styles.header} no-print`}>
      <a class={styles.home} href={href('start')}>
        <Logo />
        <span class="visually-hidden">{m.appName}</span>
      </a>
      <nav aria-label={m.nav.label} class={styles.nav}>
        <ul class={styles.navList}>
          {NAV.map((item) => (
            <li key={item}>
              <a
                class={styles.navLink}
                href={href(item)}
                aria-current={route === item ? 'page' : undefined}
              >
                {m.nav[item]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div class={styles.status}>
        {practice && <span class={styles.practice}>{m.practiceBadge}</span>}
        <span class={`${styles.saveState} tabular`} role="status">
          {status.pending > 0 ? m.persistence.saving(status.pending) : m.persistence.saved}
        </span>
        <button
          type="button"
          class={styles.iconButton}
          aria-pressed={muted}
          aria-label={muted ? m.unmute : m.mute}
          title={muted ? m.unmute : m.mute}
          onClick={() => {
            app.setPreferences({ muted: !muted });
          }}
        >
          <Icon name={muted ? 'speakerOff' : 'speaker'} />
        </button>
      </div>
    </Glass>
  );
}
