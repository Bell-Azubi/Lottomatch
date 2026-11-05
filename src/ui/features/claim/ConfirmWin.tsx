import { useState } from 'preact/hooks';
import type { ClaimantInput } from '../../../application/host-controller';
import type { TiebreakOrder, TiePolicy } from '../../../domain/settings';
import {
  applyTiebreakPass,
  drawsOfPass,
  startTiebreak,
  type TiebreakState,
} from '../../../domain/tiebreak';
import { normaliseWinner } from '../../../domain/winner';
import { claimText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/Field';
import { toWinnerInput, type AdmittedCard, type WinnerDraft } from './claim-model';
import styles from './Claim.module.css';

export interface ConfirmWinProps {
  readonly cards: readonly AdmittedCard[];
  readonly tiePolicy: TiePolicy;
  readonly tiebreakOrder: TiebreakOrder;
  /** Draws one Stechen number in 1–N from the secure random source. */
  readonly drawTiebreakNumber: () => number;
  readonly wonEarlier: (cardNo: string) => boolean;
  readonly onAddCard: () => void;
  readonly onBack: () => void;
  readonly onConfirm: (input: ClaimantInput) => void;
}

/** Gewinn bestätigen: Stechen or Teilen for several cards, then optional card number, name, note. */
export function ConfirmWin(props: ConfirmWinProps) {
  const m = t(claimText);
  const { cards } = props;
  const [drafts, setDrafts] = useState<Readonly<Record<number, WinnerDraft>>>({});
  const [tiebreak, setTiebreak] = useState<TiebreakState | undefined>(undefined);
  const needsTiebreak = cards.length > 1 && props.tiePolicy === 'TIEBREAK';
  const winnerCards = !needsTiebreak
    ? cards
    : tiebreak?.winner === undefined
      ? []
      : cards.filter((_, i) => i === tiebreak.winner);
  const label = (card: AdmittedCard, index: number) =>
    card.cardNo === '' ? m.claimant(index + 1) : `${m.claimant(index + 1)} (${card.cardNo})`;
  const draft = (card: AdmittedCard): WinnerDraft =>
    drafts[card.id] ?? { cardNo: card.cardNo, name: '', note: '' };
  const update = (card: AdmittedCard, patch: Partial<WinnerDraft>) => {
    setDrafts({ ...drafts, [card.id]: { ...draft(card), ...patch } });
  };
  const confirm = () => {
    const winners = winnerCards.map((card) => normaliseWinner(toWinnerInput(card, draft(card))));
    if (!needsTiebreak || tiebreak === undefined) {
      props.onConfirm({ winners });
      return;
    }
    const claimants = cards.map((card) => normaliseWinner(toWinnerInput(card, draft(card))));
    props.onConfirm({ winners, claimants, tiebreak: tiebreak.draws });
  };
  return (
    <div class={styles.confirm}>
      {cards.length > 1 && <p>{m.validCount(cards.length)}</p>}
      {cards.length > 1 && props.tiePolicy === 'SHARE' && <p class={styles.hint}>{m.shareHint}</p>}
      {needsTiebreak && (
        <section class={styles.tiebreak} aria-label={m.tiebreak.title}>
          <h3>{m.tiebreak.title}</h3>
          <p class={styles.hint}>{m.tiebreak.hint(props.tiebreakOrder === 'HIGHEST')}</p>
          {tiebreak !== undefined &&
            Array.from({ length: tiebreak.pass }, (_, index) => index + 1).map((pass) => (
              <div key={pass} class={styles.pass}>
                <p class={styles.passTitle}>{m.tiebreak.pass(pass)}</p>
                <ul class={styles.passList}>
                  {drawsOfPass(tiebreak, pass).map((draw) => {
                    const card = cards[draw.claimant];
                    return (
                      <li key={draw.claimant} class="tabular">
                        {card === undefined ? '' : label(card, draw.claimant)}:{' '}
                        <strong>{draw.number}</strong>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          {tiebreak?.winner === undefined ? (
            <Button
              variant="primary"
              onClick={() => {
                const state = tiebreak ?? startTiebreak(cards.length, props.tiebreakOrder);
                setTiebreak(applyTiebreakPass(state, props.drawTiebreakNumber));
              }}
            >
              {tiebreak === undefined ? m.tiebreak.run : m.tiebreak.again}
            </Button>
          ) : (
            <p class={styles.valid} role="status">
              {m.tiebreak.winner(
                label(cards[tiebreak.winner] ?? { id: -1, cardNo: '' }, tiebreak.winner),
              )}
            </p>
          )}
        </section>
      )}
      {winnerCards.map((card) => {
        const value = draft(card);
        const index = cards.indexOf(card);
        return (
          <fieldset key={card.id} class={styles.winner}>
            <legend>{label(card, index)}</legend>
            <TextField
              label={m.cardNo}
              value={value.cardNo}
              onValue={(cardNo) => {
                update(card, { cardNo });
              }}
              maxLength={20}
              autoComplete="off"
              hint={
                props.wonEarlier(value.cardNo) ? m.cardWonEarlier(value.cardNo.trim()) : undefined
              }
            />
            <TextField
              label={m.name}
              value={value.name}
              onValue={(name) => {
                update(card, { name });
              }}
              maxLength={80}
              autoComplete="off"
            />
            <TextField
              label={m.note}
              value={value.note}
              onValue={(note) => {
                update(card, { note });
              }}
              maxLength={200}
              autoComplete="off"
            />
          </fieldset>
        );
      })}
      <p class={styles.hint}>{m.privacy}</p>
      <div class={styles.verdictActions}>
        <Button onClick={props.onBack}>{m.backToCheck}</Button>
        {tiebreak === undefined && <Button onClick={props.onAddCard}>{m.addClaimant}</Button>}
        <Button variant="primary" disabled={winnerCards.length === 0} onClick={confirm}>
          {m.confirm}
        </Button>
      </div>
    </div>
  );
}
