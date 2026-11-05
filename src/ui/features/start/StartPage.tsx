import { readiness, type ReadinessItem } from '../../../application/readiness';
import { completedRoundCount } from '../../../domain/rounds';
import { commonText, startText } from '../../../i18n/catalogues';
import type { StartMessages } from '../../../i18n/de-CH/start';
import { formatCalendarDate, formatDateTime } from '../../../i18n/format';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { href, navigate } from '../../app/router';
import { Button } from '../../design-system/Button';
import { Icon } from '../../design-system/Icon';
import { Panel } from '../../design-system/Surface';
import styles from './StartPage.module.css';
import { useStartRound } from './useStartRound';

function itemText(item: ReadinessItem, m: StartMessages): string {
  const r = m.readiness;
  switch (item.key) {
    case 'prizes':
      return item.state === 'DONE' ? r.prizes : r.prizesMissing(item.count ?? 0);
    case 'display':
      return item.state === 'DONE' ? r.display : r.displayMissing;
    case 'offline':
      return item.state === 'DONE'
        ? r.offline
        : item.state === 'UNSUPPORTED'
          ? r.offlineUnsupported
          : r.offlineMissing;
    case 'backup':
      return item.lastBackupAt === undefined
        ? r.backupMissing
        : r.backupAt(formatDateTime(item.lastBackupAt));
    case 'wakeLock':
      return item.state === 'DONE' ? r.wakeLock : r.wakeLockMissing;
    case 'storage':
      return item.state === 'DONE' ? r.storage : r.storageMissing;
  }
}

/** Start: active event, status, primary action and the readiness checklist (FR-11). */
export function StartPage() {
  const m = t(startText);
  const c = t(commonText);
  const { app, hostLink, pwa } = useHostServices();
  const { request, dialog } = useStartRound(() => {
    navigate('host');
  });
  const session = app.session.value;
  if (session === undefined) {
    return (
      <Panel>
        <h1>{m.title}</h1>
        <p>{m.noEvent}</p>
      </Panel>
    );
  }
  const match = session.match.value;
  const { settings } = match;
  const game = session.game.value;
  const status =
    game.phase === 'READY'
      ? m.status.READY
      : game.phase === 'ROUND_RUNNING'
        ? m.status.ROUND_RUNNING(game.currentRound ?? 1)
        : game.phase === 'BETWEEN_ROUNDS'
          ? m.status.BETWEEN_ROUNDS(completedRoundCount(game), settings.rounds)
          : m.status.COMPLETED;
  const items = readiness({
    settings,
    catalogue: session.catalogue.value,
    display: hostLink.display.value,
    pwa: pwa.status.value,
    lastBackupAt: match.lastBackupAt,
    wakeLockSupported: app.platform.wakeLock.supported,
    persistence: app.persistence.value,
  });
  return (
    <div class={styles.page}>
      <Panel className={styles.event}>
        <h1 class={styles.name}>
          <span class="visually-hidden">{m.activeEvent}: </span>
          {settings.name}
          {match.kind === 'PRACTICE' && <span class={styles.practice}>{c.practiceBadge}</span>}
        </h1>
        <p class={styles.meta}>
          {[
            settings.date === '' ? undefined : formatCalendarDate(settings.date),
            settings.venue || undefined,
          ]
            .filter((part) => part !== undefined)
            .join(' · ')}
        </p>
        <p class={styles.status}>{status}</p>
        {match.kind === 'PRACTICE' && <p class={styles.hint}>{m.practiceHint}</p>}
        <div class={styles.actions}>
          {game.phase === 'READY' && (
            <Button variant="primary" size="lg" onClick={request}>
              {m.startRound}
            </Button>
          )}
          {(game.phase === 'ROUND_RUNNING' || game.phase === 'BETWEEN_ROUNDS') && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                navigate('host');
              }}
            >
              {m.resume}
            </Button>
          )}
          {game.phase === 'COMPLETED' && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                navigate('results');
              }}
            >
              {m.toResults}
            </Button>
          )}
          <a class={styles.link} href={href('settings')}>
            {m.switchEvent}
          </a>
        </div>
      </Panel>
      <Panel className={styles.checklist} aria-labelledby="readiness-title">
        <h2 id="readiness-title">{m.readiness.title}</h2>
        <ul class={styles.items}>
          {items.map((item) => (
            <li
              key={item.key}
              class={`${styles.item} ${item.state === 'DONE' ? styles.done : styles.open}`}
            >
              <span class={styles.mark} aria-hidden="true">
                {item.state === 'DONE' ? (
                  <Icon name="check" size={18} />
                ) : (
                  <Icon name="alert" size={18} />
                )}
              </span>
              <span>{itemText(item, m)}</span>
              <span class="visually-hidden">
                {item.state === 'DONE' ? m.readiness.done : m.readiness.open}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      {dialog}
    </div>
  );
}
