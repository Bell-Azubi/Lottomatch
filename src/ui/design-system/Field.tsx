import type { ComponentChildren, InputHTMLAttributes } from 'preact';
import { useId } from 'preact/hooks';
import styles from './Field.module.css';

interface FieldFrameProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly children: ComponentChildren;
}

function FieldFrame({ id, label, hint, error, children }: FieldFrameProps) {
  return (
    <div class={styles.field}>
      <label class={styles.label} for={id}>
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} class={styles.hint}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} class={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [
    hint === undefined ? '' : `${id}-hint`,
    error === undefined ? '' : `${id}-error`,
  ].filter(Boolean);
  return ids.length === 0 ? undefined : ids.join(' ');
}

type InputAttributes = Omit<
  InputHTMLAttributes,
  'class' | 'className' | 'id' | 'value' | 'onInput'
>;

export interface TextFieldProps extends InputAttributes {
  readonly label: string;
  readonly value: string;
  readonly onValue: (value: string) => void;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

/** Labelled text input with hint and inline error (aria-invalid, aria-describedby). */
export function TextField({ label, value, onValue, hint, error, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <input
        {...rest}
        id={id}
        class={styles.input}
        value={value}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy(id, hint, error)}
        onInput={(event) => {
          onValue(event.currentTarget.value);
        }}
      />
    </FieldFrame>
  );
}

export interface TextAreaProps {
  readonly label: string;
  readonly value: string;
  readonly onValue: (value: string) => void;
  readonly maxLength?: number;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

export function TextArea({ label, value, onValue, maxLength, hint, error }: TextAreaProps) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        class={`${styles.input} ${styles.textarea}`}
        value={value}
        maxLength={maxLength}
        rows={3}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy(id, hint, error)}
        onInput={(event) => {
          onValue(event.currentTarget.value);
        }}
      />
    </FieldFrame>
  );
}

export interface SelectFieldProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onValue: (value: T) => void;
  readonly disabled?: boolean;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onValue,
  disabled,
  hint,
  error,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        class={styles.input}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.currentTarget.value);
          if (next !== undefined) onValue(next.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

export interface ToggleProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly hint?: string | undefined;
}

/** Capsule switch (role="switch"), keyboard operable like a checkbox. */
export function Toggle({ label, checked, onChange, disabled, hint }: ToggleProps) {
  const id = useId();
  return (
    <div class={styles.toggleRow}>
      <label class={styles.toggleLabel} for={id}>
        <span>{label}</span>
        {hint !== undefined && <span class={styles.hint}>{hint}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        class={styles.toggle}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
      />
    </div>
  );
}
