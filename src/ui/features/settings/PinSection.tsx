import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/Field';
import { showToast } from '../../design-system/toast-store';
import { settingsDataText, settingsText } from './messages';
import { Section } from './Section';
import styles from './Settings.module.css';

const PIN_PATTERN = /^\d{4,8}$/;

interface PinErrors {
  readonly current?: string;
  readonly next?: string;
  readonly confirm?: string;
}

/** PIN: set, change or remove the optional guard of Preise and Einstellungen (FR-9). */
export function PinSection({ canEdit }: { readonly canEdit: boolean }) {
  const m = t(settingsDataText).pin;
  const s = t(settingsText);
  const { pin } = useHostServices();
  const configured = pin.configured.value;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PinErrors>({});
  const [busy, setBusy] = useState(false);
  const clear = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };
  const save = async () => {
    const problems: PinErrors = {
      ...(PIN_PATTERN.test(next) ? {} : { next: m.invalid }),
      ...(next === confirm ? {} : { confirm: m.mismatch }),
    };
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    setBusy(true);
    if (configured && !(await pin.verify(current))) {
      setBusy(false);
      setErrors({ current: m.wrong });
      return;
    }
    const result = await pin.set(next);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.error === 'INVALID_PIN' ? { next: m.invalid } : { next: m.readOnly });
      return;
    }
    setErrors({});
    clear();
    showToast(m.saved, { tone: 'success' });
  };
  const remove = async () => {
    setBusy(true);
    const result = await pin.remove(current);
    setBusy(false);
    if (!result.ok) {
      setErrors({ current: result.error === 'WRONG_PIN' ? m.wrong : m.readOnly });
      return;
    }
    setErrors({});
    clear();
    showToast(m.removed, { tone: 'success' });
  };
  const disabled = !canEdit || busy;
  return (
    <Section id="pin" title={s.sections.pin} intro={m.intro}>
      <p class={styles.notice} role="status">
        {configured ? m.statusOn : m.statusOff}
      </p>
      <form
        class={styles.section}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div class={styles.grid}>
          {configured && (
            <TextField
              label={m.current}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={current}
              onValue={setCurrent}
              disabled={disabled}
              error={errors.current}
            />
          )}
          <TextField
            label={m.next}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
            value={next}
            onValue={setNext}
            disabled={disabled}
            error={errors.next}
          />
          <TextField
            label={m.confirm}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
            value={confirm}
            onValue={setConfirm}
            disabled={disabled}
            error={errors.confirm}
          />
        </div>
        <div class={styles.actions}>
          <Button type="submit" variant="primary" disabled={disabled}>
            {configured ? m.change : m.set}
          </Button>
          {configured && (
            <Button
              variant="danger"
              disabled={disabled}
              onClick={() => {
                void remove();
              }}
            >
              {m.remove}
            </Button>
          )}
        </div>
      </form>
    </Section>
  );
}
