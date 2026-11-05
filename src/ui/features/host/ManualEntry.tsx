import { liveText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { TextField } from '../../design-system/Field';
import { NeuButton } from '../../design-system/NeuButton';
import { appendDigit, clearBuffer, manualBuffer, manualError, removeDigit } from './manual-buffer';
import styles from './ManualEntry.module.css';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export interface ManualEntryProps {
  readonly disabled: boolean;
  /** Validates and commits the typed number; never called after a single digit. */
  readonly onCommit: (raw: string) => void;
}

/** Zahl eintragen: field plus on-screen keypad; digits are only committed with Enter (FR-3). */
export function ManualEntry({ disabled, onCommit }: ManualEntryProps) {
  const m = t(liveText).manual;
  const commit = () => {
    onCommit(manualBuffer.value);
  };
  return (
    <form
      class={styles.entry}
      aria-label={m.title}
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <TextField
        label={m.label}
        value={manualBuffer.value}
        onValue={(value) => {
          manualError.value = undefined;
          manualBuffer.value = value.slice(0, 6);
        }}
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        hint={m.hint}
        error={manualError.value}
        disabled={disabled}
      />
      <div class={styles.keypad}>
        {DIGITS.map((digit) => (
          <NeuButton
            key={digit}
            disabled={disabled}
            onClick={() => {
              appendDigit(digit);
            }}
          >
            {digit}
          </NeuButton>
        ))}
        <NeuButton disabled={disabled} aria-label={m.clear} onClick={clearBuffer}>
          C
        </NeuButton>
        <NeuButton
          disabled={disabled}
          onClick={() => {
            appendDigit('0');
          }}
        >
          0
        </NeuButton>
        <NeuButton disabled={disabled} aria-label={m.backspace} onClick={removeDigit}>
          ⌫
        </NeuButton>
      </div>
      <NeuButton className={styles.enter} disabled={disabled} onClick={commit}>
        {m.submit}
      </NeuButton>
    </form>
  );
}
