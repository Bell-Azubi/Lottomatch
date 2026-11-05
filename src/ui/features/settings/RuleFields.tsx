import type { LateClaimPolicy, TiebreakOrder, TiePolicy } from '../../../domain/settings';
import { t } from '../../../i18n';
import { SelectField, TextArea, TextField, Toggle } from '../../design-system/Field';
import type { DraftFieldsProps } from './GameFields';
import { settingsText } from './messages';
import styles from './Settings.module.css';

const LATE: readonly LateClaimPolicy[] = ['HOST_DECIDES', 'ALLOW', 'REJECT'];
const TIE: readonly TiePolicy[] = ['TIEBREAK', 'SHARE'];
const ORDER: readonly TiebreakOrder[] = ['HIGHEST', 'LOWEST'];

/** Claim and tie policies, board reset, display privacy, sponsors and the payout indicator. */
export function RuleFields({ draft, update, errors, disabled, locked }: DraftFieldsProps) {
  const m = t(settingsText);
  return (
    <>
      <fieldset class={styles.group}>
        <legend class={styles.legend}>{m.form.rules}</legend>
        <div class={styles.grid}>
          <SelectField
            label={m.form.lateClaim}
            value={draft.lateClaimPolicy}
            options={LATE.map((value) => ({ value, label: m.form.lateClaimOptions[value] }))}
            onValue={(lateClaimPolicy) => {
              update({ lateClaimPolicy });
            }}
            disabled={disabled}
          />
          <SelectField
            label={m.form.tiePolicy}
            value={draft.tiePolicy}
            options={TIE.map((value) => ({ value, label: m.form.tiePolicyOptions[value] }))}
            onValue={(tiePolicy) => {
              update({ tiePolicy });
            }}
            disabled={disabled}
          />
          <SelectField
            label={m.form.tiebreakOrder}
            value={draft.tiebreakOrder}
            options={ORDER.map((value) => ({ value, label: m.form.tiebreakOrderOptions[value] }))}
            onValue={(tiebreakOrder) => {
              update({ tiebreakOrder });
            }}
            disabled={disabled || draft.tiePolicy !== 'TIEBREAK'}
          />
        </div>
        <Toggle
          label={m.form.boardReset}
          checked={draft.prizeReset}
          onChange={(prizeReset) => {
            update({ prizeReset });
          }}
          disabled={disabled || locked}
          hint={locked ? m.form.locked : m.form.boardResetHint}
        />
        {errors.boardReset !== undefined && <p class={styles.errorText}>{errors.boardReset}</p>}
        <Toggle
          label={m.form.showNames}
          checked={draft.showNamesOnDisplay}
          onChange={(showNamesOnDisplay) => {
            update({ showNamesOnDisplay });
          }}
          disabled={disabled}
          hint={m.form.showNamesHint}
        />
      </fieldset>
      <fieldset class={styles.group} disabled={disabled}>
        <legend class={styles.legend}>{m.form.sponsors}</legend>
        <TextArea
          label={m.form.sponsors}
          value={draft.sponsors}
          onValue={(sponsors) => {
            update({ sponsors });
          }}
          hint={m.form.sponsorsHint}
          error={errors.sponsors}
        />
      </fieldset>
      <fieldset class={styles.group}>
        <legend class={styles.legend}>{m.form.payout}</legend>
        <Toggle
          label={m.form.payoutEnabled}
          checked={draft.payoutEnabled}
          onChange={(payoutEnabled) => {
            update({ payoutEnabled });
          }}
          disabled={disabled}
          hint={m.form.payoutHint}
        />
        <div class={styles.grid}>
          <TextField
            label={m.form.stakes}
            value={draft.stakes}
            onValue={(stakes) => {
              update({ stakes });
            }}
            inputMode="decimal"
            disabled={disabled || !draft.payoutEnabled}
          />
          <TextField
            label={m.form.minRatio}
            value={draft.minRatio}
            onValue={(minRatio) => {
              update({ minRatio });
            }}
            inputMode="numeric"
            disabled={disabled || !draft.payoutEnabled}
          />
        </div>
        {errors.payout !== undefined && <p class={styles.errorText}>{errors.payout}</p>}
      </fieldset>
    </>
  );
}
