import { useState } from 'preact/hooks';
import type { ClaimantInput } from '../../../application/host-controller';
import { LIMITS } from '../../../domain/limits';
import type { TiebreakOrder, TiePolicy } from '../../../domain/settings';
import {
  applyTiebreakPass,
  drawsOfPass,
  startTiebreak,
  type TiebreakState,
} from '../../../domain/tiebreak';
import { normaliseWinner } from '../../../domain/winner';
import { claimText, commonText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { TextField } from '../../design-system/Field';
import styles from './Claim.module.css';

/** One winning card as typed into the form. */
interface Card {
  readonly id: number;
  readonly cardNo: string;
  readonly name: string;
  readonly note: string;
}

function newCard(id: number): Card {
  return { id, cardNo: '', name: '', note: '' };
}

export interface ConfirmWinProps {
  readonly tiePolicy: TiePolicy;
  readonly tiebreakOrder: TiebreakOrder;
  /** Draws one Stechen number in 1–N from the secure random source. */
  readonly drawTiebreakNumber: () => number;
  readonly wonEarlier: (cardNo: string) => boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (input: ClaimantInput) => void;
}

/** Gewinn bestätigen: optional card number, name, note; Stechen or Teilen for several cards. */
export function ConfirmWin(props: ConfirmWinProps) {
  const m = t(claimText);
  const c = t(commonText);
  const [cards, setCards] = useState<readonly Card[]>([newCard(1)]);
  const [tiebreak, setTiebreak] = useState<TiebreakState | undefined>(undefined);
  const needsTiebreak = cards.length > 1 && props.tiePolicy === 'TIEBREAK';
  const decided = !needsTiebreak || tiebreak?.winner !== undefined;
  const winnerCards = needsTiebreak ? cards.filter((_, i) => i === tiebreak?.winner) : cards;
  const label = (card: Card, index: number) => {
    const cardNo = card.cardNo.trim();
    return cardNo === '' ? m.claimant(index + 1) : `${m.claimant(index + 1)} (${cardNo})`;
  };
  const update = (id: number, patch: Partial<Card>) => {
    setCards(cards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  };
  const toWinner = ({ cardNo, name, note }: Card) => normaliseWinner({ cardNo, name, note });
  const confirm = () => {
    const winners = winnerCards.map(toWinner);
    if (!needsTiebreak || tiebreak === undefined) {
      props.onConfirm({ winners });
      return;
    }
    props.onConfirm({ winners, claimants: cards.map(toWinner), tiebreak: tiebreak.draws });
  };
  // Until a Stechen is decided every card needs its number; the winner's details follow after it.
  const shown = decided ? winnerCards : cards;
  const canChangeCards = tiebreak === undefined;
  return (
    <div class={styles.confirm}>
      {cards.length > 1 && <p>{m.validCount(cards.length)}</p>}
      {cards.length > 1 && props.tiePolicy === 'SHARE' && <p class={styles.hint}>{m.shareHint}</p>}
      {shown.map((card) => {
        const index = cards.indexOf(card);
        return (
          <fieldset key={card.id} class={styles.winner}>
            <legend>{label(card, index)}</legend>
            <TextField
              label={m.cardNo}
              value={card.cardNo}
              onValue={(cardNo) => {
                update(card.id, { cardNo });
              }}
              maxLength={LIMITS.cardNo}
              autoComplete="off"
              hint={
                props.wonEarlier(card.cardNo) ? m.cardWonEarlier(card.cardNo.trim()) : undefined
              }
            />
            {decided && (
              <>
                <TextField
                  label={m.name}
                  value={card.name}
                  onValue={(name) => {
                    update(card.id, { name });
                  }}
                  maxLength={LIMITS.winnerName}
                  autoComplete="off"
                />
                <TextField
                  label={m.note}
                  value={card.note}
                  onValue={(note) => {
                    update(card.id, { note });
                  }}
                  maxLength={LIMITS.winnerNote}
                  autoComplete="off"
                />
              </>
            )}
            {canChangeCards && cards.length > 1 && (
              <div class={styles.actions}>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setCards(cards.filter((entry) => entry.id !== card.id));
                  }}
                >
                  {m.removeClaimant}
                </Button>
              </div>
            )}
          </fieldset>
        );
      })}
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
            <p class={styles.tiebreakWinner} role="status">
              {m.tiebreak.winner(label(cards[tiebreak.winner] ?? newCard(-1), tiebreak.winner))}
            </p>
          )}
        </section>
      )}
      <p class={styles.hint}>{m.privacy}</p>
      <div class={styles.actions}>
        <Button onClick={props.onCancel}>{c.actions.cancel}</Button>
        {canChangeCards && cards.length < LIMITS.maxWinners && (
          <Button
            onClick={() => {
              setCards([...cards, newCard((cards.at(-1)?.id ?? 0) + 1)]);
            }}
          >
            {m.addClaimant}
          </Button>
        )}
        <Button variant="primary" disabled={!decided} onClick={confirm}>
          {m.confirm}
        </Button>
      </div>
    </div>
  );
}
