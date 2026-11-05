import type { SettingsField } from '../../../domain/settings';
import type { PrizeSlot, WinConditionKind } from '../../../domain/types';
import { PRIZE_SLOTS } from '../../../domain/types';
import { commonText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { SelectField, TextField } from '../../design-system/Field';
import { parseWholeNumber, type ConditionDraft, type EventDraft } from './event-draft';
import { settingsText } from './messages';
import styles from './Settings.module.css';

export interface DraftFieldsProps {
  readonly draft: EventDraft;
  readonly update: (patch: Partial<EventDraft>) => void;
  readonly errors: Partial<Record<SettingsField, string>>;
  readonly disabled: boolean;
  /** True while a round runs: N, card layout and board reset are frozen (I6). */
  readonly locked: boolean;
  readonly minRounds: number;
}

const KINDS: readonly WinConditionKind[] = ['ONE_LINE', 'TWO_LINES', 'FULL_CARD', 'CUSTOM'];

/** Rounds, highest number, card layout and the win-condition template. */
export function GameFields({
  draft,
  update,
  errors,
  disabled,
  locked,
  minRounds,
}: DraftFieldsProps) {
  const m = t(settingsText);
  const c = t(commonText);
  const lockedHint = locked ? m.form.locked : undefined;
  const fullCard = parseWholeNumber(draft.perLine) * parseWholeNumber(draft.lines);
  const setCondition = (slot: PrizeSlot, patch: Partial<ConditionDraft>) => {
    update({ template: { ...draft.template, [slot]: { ...draft.template[slot], ...patch } } });
  };
  return (
    <>
      <fieldset class={styles.group}>
        <legend class={styles.legend}>{m.form.game}</legend>
        <div class={styles.grid}>
          <TextField
            label={m.form.rounds}
            value={draft.rounds}
            onValue={(rounds) => {
              update({ rounds });
            }}
            inputMode="numeric"
            disabled={disabled}
            hint={m.form.roundsHint(minRounds)}
            error={errors.rounds}
          />
          <TextField
            label={m.form.maxNumber}
            value={draft.maxNumber}
            onValue={(maxNumber) => {
              update({ maxNumber });
            }}
            inputMode="numeric"
            disabled={disabled || locked}
            hint={lockedHint ?? m.form.maxNumberHint}
            error={errors.maxNumber}
          />
        </div>
      </fieldset>
      <fieldset class={styles.group}>
        <legend class={styles.legend}>{m.form.card}</legend>
        <div class={styles.grid}>
          <TextField
            label={m.form.perLine}
            value={draft.perLine}
            onValue={(perLine) => {
              update({ perLine });
            }}
            inputMode="numeric"
            disabled={disabled || locked}
            hint={lockedHint}
            error={errors.perLine}
          />
          <TextField
            label={m.form.lines}
            value={draft.lines}
            onValue={(lines) => {
              update({ lines });
            }}
            inputMode="numeric"
            disabled={disabled || locked}
            hint={lockedHint}
            error={errors.lines}
          />
        </div>
        {Number.isFinite(fullCard) && <p class={styles.hint}>{m.form.cardHint(fullCard)}</p>}
        {errors.cardSize !== undefined && <p class={styles.errorText}>{errors.cardSize}</p>}
      </fieldset>
      <fieldset class={styles.group}>
        <legend class={styles.legend}>{m.form.template}</legend>
        <p class={styles.hint}>{m.form.templateHint}</p>
        <div class={styles.grid}>
          {PRIZE_SLOTS.map((slot) => {
            const condition = draft.template[slot];
            const slotName = c.prizeSlot(slot);
            return (
              <div key={slot} class={styles.itemMain}>
                <SelectField
                  label={m.form.slotRule(slotName)}
                  value={condition.kind}
                  options={KINDS.map((kind) => ({ value: kind, label: c.conditions[kind] }))}
                  onValue={(kind) => {
                    setCondition(slot, { kind });
                  }}
                  disabled={disabled}
                />
                {condition.kind === 'CUSTOM' && (
                  <TextField
                    label={m.form.customLabel(slotName)}
                    value={condition.label}
                    onValue={(label) => {
                      setCondition(slot, { label });
                    }}
                    maxLength={60}
                    disabled={disabled}
                  />
                )}
              </div>
            );
          })}
        </div>
        {errors.template !== undefined && <p class={styles.errorText}>{errors.template}</p>}
      </fieldset>
    </>
  );
}
