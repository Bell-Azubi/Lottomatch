import { useState } from 'preact/hooks';
import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { Button } from '../design-system/Button';
import { useServices } from './context';
import styles from './SystemBanners.module.css';

/**
 * Persistent system notices: read-only window with takeover, storage failures with an immediate
 * export, memory-only storage, and the update prompt (only between rounds).
 */
export function SystemBanners() {
  const m = t(commonText);
  const { app, hostLink, pwa } = useServices();
  const [taking, setTaking] = useState(false);
  const control = hostLink?.control.value;
  const status = app.queue.status.value;
  const phase = app.session.value?.game.value.phase;
  const updateReady = pwa.status.value.updateReady && phase !== 'ROUND_RUNNING';
  const exportNow = () => {
    void import('../../application/backup-export').then(({ downloadBackup }) =>
      downloadBackup(app),
    );
  };
  return (
    <div class={`${styles.stack} no-print`}>
      {control === 'READ_ONLY' && (
        <div class={styles.banner} role="status">
          <p>{m.control.readOnly}</p>
          <Button
            variant="primary"
            disabled={taking}
            onClick={() => {
              setTaking(true);
              void hostLink?.takeOver().finally(() => {
                setTaking(false);
              });
            }}
          >
            {taking ? m.control.taking : m.control.takeOver}
          </Button>
        </div>
      )}
      {status.problem !== undefined && (
        <div class={`${styles.banner} ${styles.danger}`} role="alert">
          <p>{m.persistence[status.problem]}</p>
          {status.fatal ? (
            <Button
              variant="secondary"
              onClick={() => {
                window.location.reload();
              }}
            >
              {m.actions.reload}
            </Button>
          ) : (
            <Button variant="secondary" onClick={exportNow}>
              {m.persistence.exportNow}
            </Button>
          )}
        </div>
      )}
      {app.platform.backend === 'MEMORY' && (
        <div class={`${styles.banner} ${styles.danger}`} role="alert">
          <p>{m.storage.memory}</p>
          <Button variant="secondary" onClick={exportNow}>
            {m.persistence.exportNow}
          </Button>
        </div>
      )}
      {updateReady && (
        <div class={styles.banner} role="status">
          <p>
            <strong>{m.update.ready}.</strong> {m.update.body}
          </p>
          <Button
            variant="primary"
            onClick={() => {
              app.platform.sync.publish({ t: 'reload' });
              void pwa.apply();
            }}
          >
            {m.update.apply}
          </Button>
        </div>
      )}
    </div>
  );
}
