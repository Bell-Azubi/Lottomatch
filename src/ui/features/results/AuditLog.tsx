import { useMemo, useState } from 'preact/hooks';
import {
  AUDIT_CATEGORIES,
  auditRounds,
  filterAudit,
  type AuditCategory,
  type AuditEntry,
} from '../../../application/audit';
import type { ChainVerification } from '../../../application/ports';
import { commonText } from '../../../i18n/catalogues';
import { formatDateTime } from '../../../i18n/format';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { SelectField } from '../../design-system/Field';
import { Panel } from '../../design-system/Surface';
import styles from './AuditLog.module.css';
import { describeAudit } from './audit-text';
import resultsStyles from './Results.module.css';
import { auditText } from './text';

/** Entries rendered per step; the log of a long evening holds thousands. */
export const AUDIT_PAGE_SIZE = 100;

type Verification =
  | { readonly state: 'IDLE' }
  | { readonly state: 'RUNNING' }
  | { readonly state: 'DONE'; readonly result: ChainVerification }
  | { readonly state: 'FAILED' };

/** Audit-log viewer with category and round filters and hash-chain verification (FR-11). */
export function AuditLog({
  entries,
  verify,
}: {
  readonly entries: readonly AuditEntry[];
  readonly verify: () => Promise<ChainVerification>;
}) {
  const m = t(auditText);
  const c = t(commonText);
  const [category, setCategory] = useState<AuditCategory | 'ALL'>('ALL');
  const [round, setRound] = useState('ALL');
  const [limit, setLimit] = useState(AUDIT_PAGE_SIZE);
  const [verification, setVerification] = useState<Verification>({ state: 'IDLE' });
  const rounds = useMemo(() => auditRounds(entries), [entries]);
  const filtered = useMemo(
    () => filterAudit(entries, { category, round: round === 'ALL' ? 'ALL' : Number(round) }),
    [entries, category, round],
  );
  const shown = filtered.slice(0, limit);
  const categoryOptions: { value: AuditCategory | 'ALL'; label: string }[] = [
    { value: 'ALL', label: m.allCategories },
    ...AUDIT_CATEGORIES.map((value) => ({ value, label: m.categories[value] })),
  ];
  const roundOptions = [
    { value: 'ALL', label: m.allRounds },
    ...rounds.map((value) => ({ value: String(value), label: m.roundOption(value) })),
  ];
  const runVerification = () => {
    setVerification({ state: 'RUNNING' });
    verify()
      .then((result) => {
        setVerification({ state: 'DONE', result });
      })
      .catch(() => {
        setVerification({ state: 'FAILED' });
      });
  };
  return (
    <Panel className={resultsStyles.section} aria-labelledby="results-audit-title">
      <h2 id="results-audit-title">{m.title}</h2>
      <p>{m.intro}</p>
      <div class={styles.filters}>
        <SelectField
          label={m.category}
          value={category}
          options={categoryOptions}
          onValue={(value) => {
            setCategory(value);
            setLimit(AUDIT_PAGE_SIZE);
          }}
        />
        <SelectField
          label={m.round}
          value={round}
          options={roundOptions}
          onValue={(value) => {
            setRound(value);
            setLimit(AUDIT_PAGE_SIZE);
          }}
        />
      </div>
      {shown.length === 0 ? (
        <p>{m.empty}</p>
      ) : (
        <ol class={styles.list} aria-labelledby="results-audit-title">
          {shown.map((entry) => (
            <li key={entry.seq} class={styles.item}>
              <span class={styles.seq}>{m.entry(entry.seq)}</span>
              <time class={styles.time} dateTime={entry.at}>
                {formatDateTime(entry.at)}
              </time>
              <span class={styles.category}>{m.categories[entry.category]}</span>
              <span class={styles.text}>{describeAudit(entry, m, c)}</span>
            </li>
          ))}
        </ol>
      )}
      <div class={styles.footer}>
        <p role="status">{m.count(shown.length, filtered.length)}</p>
        {filtered.length > shown.length && (
          <Button
            onClick={() => {
              setLimit(limit + AUDIT_PAGE_SIZE);
            }}
          >
            {m.more}
          </Button>
        )}
      </div>
      <div class={styles.verify}>
        <p class={resultsStyles.privacy}>{m.verify.hint}</p>
        <div>
          <Button disabled={verification.state === 'RUNNING'} onClick={runVerification}>
            {verification.state === 'RUNNING' ? m.verify.running : m.verify.button}
          </Button>
        </div>
        {verification.state === 'DONE' && (
          <p
            role="status"
            class={`${styles.verifyResult} ${verification.result.ok ? '' : styles.verifyBroken}`}
          >
            {verification.result.ok
              ? m.verify.ok(verification.result.checked)
              : m.verify.broken(verification.result.brokenAt)}
          </p>
        )}
        {verification.state === 'FAILED' && (
          <p role="alert" class={`${styles.verifyResult} ${styles.verifyBroken}`}>
            {m.verify.failed}
          </p>
        )}
      </div>
    </Panel>
  );
}
