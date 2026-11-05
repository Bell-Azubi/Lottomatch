import { useState } from 'preact/hooks';
import type { WinnerResult } from '../../../application/results';
import { LIMITS } from '../../../domain/limits';
import type { Winner } from '../../../domain/types';
import { normaliseWinner } from '../../../domain/winner';
import { commonText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { TextField } from '../../design-system/Field';
import styles from './Results.module.css';
import { resultsText } from './text';

interface WinnerFields {
  readonly cardNo: string;
  readonly name: string;
  readonly note: string;
}

export interface CorrectionDialogProps {
  readonly prizeLabel: string;
  readonly winners: readonly WinnerResult[];
  readonly error: string | undefined;
  readonly onClose: () => void;
  readonly onSave: (winners: readonly Winner[], reason: string) => void;
}

/**
 * Corrects the details of an earlier award (card number, name, note). The number of winning
 * cards and the claim reference stay; the correction is audit-logged with an optional reason.
 */
export function CorrectionDialog({
  prizeLabel,
  winners,
  error,
  onClose,
  onSave,
}: CorrectionDialogProps) {
  const m = t(resultsText);
  const c = t(commonText);
  const [fields, setFields] = useState<readonly WinnerFields[]>(() =>
    winners.map((winner) => ({
      cardNo: winner.cardNo ?? '',
      name: winner.name ?? '',
      note: winner.note ?? '',
    })),
  );
  const [reason, setReason] = useState('');
  const update = (index: number, patch: Partial<WinnerFields>) => {
    setFields(
      fields.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)),
    );
  };
  const save = () => {
    onSave(
      fields.map((entry, index) =>
        normaliseWinner({ ...entry, validSinceSeq: winners[index]?.validSinceSeq }),
      ),
      reason,
    );
  };
  return (
    <Dialog
      open
      title={m.correction.title(prizeLabel)}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{c.actions.cancel}</Button>
          <Button variant="primary" onClick={save}>
            {c.actions.save}
          </Button>
        </>
      }
    >
      <p>{m.correction.body}</p>
      {fields.map((entry, index) => (
        <fieldset key={index} class={styles.fieldset}>
          <legend class={styles.legend}>{m.correction.winner(index + 1)}</legend>
          <TextField
            label={m.correction.cardNo}
            value={entry.cardNo}
            maxLength={LIMITS.cardNo}
            autoComplete="off"
            onValue={(value) => {
              update(index, { cardNo: value });
            }}
          />
          <TextField
            label={m.correction.name}
            value={entry.name}
            maxLength={LIMITS.winnerName}
            autoComplete="off"
            onValue={(value) => {
              update(index, { name: value });
            }}
          />
          <TextField
            label={m.correction.note}
            value={entry.note}
            maxLength={LIMITS.winnerNote}
            autoComplete="off"
            onValue={(value) => {
              update(index, { note: value });
            }}
          />
        </fieldset>
      ))}
      <TextField
        label={m.correction.reason}
        value={reason}
        maxLength={LIMITS.reason}
        autoComplete="off"
        onValue={setReason}
        error={error}
      />
    </Dialog>
  );
}
