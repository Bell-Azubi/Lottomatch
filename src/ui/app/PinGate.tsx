import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { Button } from '../design-system/Button';
import { Dialog } from '../design-system/Dialog';
import { TextField } from '../design-system/Field';
import { Panel } from '../design-system/Surface';
import { useServices } from './context';
import styles from './PinGate.module.css';

/** Guards Preise and Einstellungen with the optional PIN (FR-9). */
export function PinGate({ children }: { readonly children: ComponentChildren }) {
  const m = t(commonText);
  const { pin } = useServices();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  if (!pin.configured.value || pin.unlocked.value) return <>{children}</>;
  return (
    <Panel className={styles.gate}>
      <h1>{m.pinGate.title}</h1>
      <p>{m.pinGate.body}</p>
      <form
        class={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void pin.verify(value).then((matches) => {
            setValue('');
            setError(matches ? undefined : m.pinGate.wrong);
          });
        }}
      >
        <TextField
          label={m.pinGate.label}
          value={value}
          onValue={setValue}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          error={error}
        />
        <Button type="submit" variant="primary">
          {m.pinGate.submit}
        </Button>
      </form>
      <Button
        variant="quiet"
        onClick={() => {
          setResetOpen(true);
        }}
      >
        {m.pinGate.forgot}
      </Button>
      <Dialog
        open={resetOpen}
        title={m.pinGate.resetTitle}
        tone="danger"
        onClose={() => {
          setResetOpen(false);
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setResetOpen(false);
              }}
            >
              {m.actions.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={confirmText.trim() !== m.pinGate.resetWord}
              onClick={() => {
                void pin.resetForgotten().then(() => {
                  setResetOpen(false);
                });
              }}
            >
              {m.pinGate.reset}
            </Button>
          </>
        }
      >
        <p>{m.pinGate.resetBody}</p>
        <TextField
          label={m.pinGate.resetConfirm}
          value={confirmText}
          onValue={setConfirmText}
          autoComplete="off"
        />
      </Dialog>
    </Panel>
  );
}
