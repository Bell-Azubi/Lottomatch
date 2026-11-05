import { useState } from 'preact/hooks';
import type { RecoveryCause } from '../../application/app-store';
import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { Button } from '../design-system/Button';
import { TextField } from '../design-system/Field';
import { Logo } from '../design-system/Logo';
import { Panel } from '../design-system/Surface';
import { useServices } from './context';
import styles from './RecoveryScreen.module.css';

function describe(cause: RecoveryCause): { code: string; seq?: number } {
  switch (cause.code) {
    case 'LOG_CORRUPT':
      return { code: `${cause.code}/${cause.reason}`, seq: cause.seq };
    case 'MATCHES_CORRUPT':
      return { code: `${cause.code} (${cause.count})` };
    case 'MATCH_CORRUPT':
    case 'CATALOGUE_CORRUPT':
    case 'STORAGE_FAILED':
      return { code: cause.code };
  }
}

/** Shown instead of a blank screen when stored data is corrupt (§6). */
export function RecoveryScreen({ cause }: { readonly cause: RecoveryCause }) {
  const m = t(commonText);
  const { app } = useServices();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const detail = describe(cause);
  const { maintenance, screen, binary, clock } = app.platform;
  return (
    <main class={styles.main}>
      <Panel className={styles.panel}>
        <Logo />
        <h1>{m.recovery.title}</h1>
        <p>{m.recovery.body}</p>
        <p class={styles.code}>{m.recovery.detail(detail.code, detail.seq)}</p>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void maintenance
              .dumpAll()
              .then((text) => {
                screen.download(
                  `lottomatch-rohdaten-${clock.nowIso().slice(0, 10)}.json`,
                  binary.textToBlob(text, 'application/json'),
                );
              })
              .finally(() => {
                setBusy(false);
              });
          }}
        >
          {m.recovery.exportRaw}
        </Button>
        <TextField
          label={m.recovery.resetConfirm}
          value={confirmText}
          onValue={setConfirmText}
          autoComplete="off"
        />
        <Button
          variant="danger"
          disabled={busy || confirmText.trim() !== m.recovery.resetWord}
          onClick={() => {
            setBusy(true);
            void maintenance.wipe().finally(() => {
              window.location.reload();
            });
          }}
        >
          {m.recovery.reset}
        </Button>
      </Panel>
    </main>
  );
}
