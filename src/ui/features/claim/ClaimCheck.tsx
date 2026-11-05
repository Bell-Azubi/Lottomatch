import { useState } from 'preact/hooks';
import type { LateClaimPolicy } from '../../../domain/settings';
import type { DrawEntry } from '../../../domain/state';
import { claimText } from '../../../i18n/catalogues';
import type { ClaimMessages } from '../../../i18n/de-CH/claim';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/Field';
import { Icon } from '../../design-system/Icon';
import { addClaimNumber, checkCard, countReached, type AddNumberError } from './claim-model';
import styles from './Claim.module.css';

export interface ClaimCheckProps {
  readonly pool: readonly DrawEntry[];
  readonly expected: number | undefined;
  readonly maxNumber: number;
  readonly policy: LateClaimPolicy;
  readonly cardIndex: number;
  readonly onAdmit: (
    cardNo: string,
    validSinceSeq: number | undefined,
    confirmNow: boolean,
  ) => void;
  readonly onReject: (
    claimed: readonly number[],
    missing: readonly number[],
    lateSinceSeq?: number,
  ) => void;
}

function addError(error: AddNumberError, m: ClaimMessages): string {
  switch (error.code) {
    case 'NOT_A_NUMBER':
      return m.notANumber;
    case 'OUT_OF_RANGE':
      return m.outOfRange(error.max);
    case 'DUPLICATE':
      return m.duplicate(error.number);
  }
}

/** Number chips for one card, each marked drawn or missing, and the verdict (FR-6). */
export function ClaimCheck({
  pool,
  expected,
  maxNumber,
  policy,
  cardIndex,
  onAdmit,
  onReject,
}: ClaimCheckProps) {
  const m = t(claimText);
  const [numbers, setNumbers] = useState<readonly number[]>([]);
  const [input, setInput] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const drawnSet = new Set(pool.map((d) => d.number));
  const reached = countReached(numbers, expected);
  const result = reached ? checkCard(pool, numbers, expected, policy) : undefined;
  const latest = result?.evaluation.latest;
  const since = result?.evaluation.validSince;
  const add = () => {
    const next = addClaimNumber(numbers, input, maxNumber);
    if (!next.ok) {
      setError(addError(next.error, m));
      return;
    }
    setNumbers(next.value);
    setInput('');
    setError(undefined);
  };
  return (
    <div class={styles.check}>
      <p class={styles.cardTitle}>{m.claimant(cardIndex)}</p>
      <TextField
        label={m.cardNo}
        value={cardNo}
        onValue={setCardNo}
        maxLength={20}
        autoComplete="off"
      />
      <form
        class={styles.addRow}
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <TextField
          label={m.numberLabel}
          value={input}
          onValue={(value) => {
            setInput(value);
            setError(undefined);
          }}
          inputMode="numeric"
          autoComplete="off"
          error={error}
          hint={expected === undefined ? m.free : m.expected(expected)}
          disabled={reached && expected !== undefined}
        />
        <Button type="submit" disabled={reached && expected !== undefined}>
          {m.add}
        </Button>
      </form>
      <p class="tabular" aria-live="polite">
        {m.count(numbers.length, expected)}
      </p>
      <ul class={styles.chips} aria-label={m.chipsLabel}>
        {numbers.map((number) => {
          const drawn = drawnSet.has(number);
          return (
            <li
              key={number}
              class={`${styles.chip} ${drawn ? styles.chipDrawn : styles.chipMissing}`}
            >
              <Icon name={drawn ? 'check' : 'alert'} size={16} />
              <span>{drawn ? m.chipDrawn(number) : m.chipMissing(number)}</span>
              <button
                type="button"
                class={styles.chipRemove}
                aria-label={m.removeChip(number)}
                onClick={() => {
                  setNumbers(numbers.filter((n) => n !== number));
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {result !== undefined && (
        <div class={styles.verdict} role="status">
          {result.verdict === 'INVALID' && (
            <>
              <p class={styles.invalid}>
                <strong>{m.invalid}.</strong>{' '}
                {result.evaluation.missing.length > 0
                  ? m.missingList(result.evaluation.missing.join(', '))
                  : m.wrongCount(numbers.length, expected ?? numbers.length)}
              </p>
              <Button
                variant="danger"
                disabled={result.evaluation.missing.length === 0}
                onClick={() => {
                  onReject(numbers, result.evaluation.missing);
                }}
              >
                {m.recordFalse}
              </Button>
            </>
          )}
          {result.verdict !== 'INVALID' && since !== undefined && latest !== undefined && (
            <p
              class={
                result.verdict === 'VALID' && !result.evaluation.late ? styles.valid : styles.late
              }
            >
              <strong>{result.evaluation.late ? m.late : m.valid}.</strong>{' '}
              {m.validSince(since.seq, since.number, latest.seq)}
            </p>
          )}
          {result.verdict === 'VALID' && (
            <div class={styles.verdictActions}>
              <Button
                variant="primary"
                onClick={() => {
                  onAdmit(cardNo, since?.seq, true);
                }}
              >
                {m.confirm}
              </Button>
              <Button
                onClick={() => {
                  onAdmit(cardNo, since?.seq, false);
                }}
              >
                {m.addClaimant}
              </Button>
            </div>
          )}
          {result.verdict === 'LATE_DECIDE' && (
            <div class={styles.verdictActions}>
              <Button
                variant="primary"
                onClick={() => {
                  onAdmit(cardNo, since?.seq, true);
                }}
              >
                {m.lateAllow}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  onReject(numbers, [], since?.seq);
                }}
              >
                {m.lateReject}
              </Button>
            </div>
          )}
          {result.verdict === 'LATE_REJECTED' && (
            <>
              <p>{m.latePolicyRejects}</p>
              <Button
                variant="danger"
                onClick={() => {
                  onReject(numbers, [], since?.seq);
                }}
              >
                {m.recordFalse}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
