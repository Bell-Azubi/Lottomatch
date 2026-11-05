import type { PrizeResult, TiebreakResult, WinnerResult } from '../../../application/results';
import type { HandoutStatus, PrizeSlot } from '../../../domain/types';
import { commonText } from '../../../i18n/catalogues';
import type { ResultsMessages } from '../../../i18n/de-CH/results';
import { formatChf } from '../../../i18n/format';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import styles from './Results.module.css';
import { resultsText } from './text';

export interface PrizeActions {
  readonly canEdit: boolean;
  readonly onHandout: (round: number, slot: PrizeSlot, status: HandoutStatus) => void;
  readonly onCorrect: (round: number, slot: PrizeSlot) => void;
}

function claimantLabel(tiebreak: TiebreakResult, index: number, m: ResultsMessages): string {
  const cardNo = tiebreak.claimants[index]?.cardNo;
  return cardNo === undefined ? m.tiebreak.claim(index + 1) : m.prize.card(cardNo);
}

function TiebreakDetails({ tiebreak }: { readonly tiebreak: TiebreakResult }) {
  const m = t(resultsText);
  return (
    <details class={styles.tiebreak}>
      <summary>{m.tiebreak.title}</summary>
      <ol class={styles.tiebreakPasses}>
        {tiebreak.passes.map((pass) => (
          <li key={pass.pass}>
            {m.tiebreak.pass(pass.pass)}:{' '}
            {pass.draws
              .map((draw) =>
                m.tiebreak.draw(claimantLabel(tiebreak, draw.claimant, m), draw.number),
              )
              .join(', ')}
          </li>
        ))}
      </ol>
      {tiebreak.winner !== undefined && (
        <p>{m.tiebreak.winner(claimantLabel(tiebreak, tiebreak.winner, m))}</p>
      )}
    </details>
  );
}

function WinnerLine({ winner }: { readonly winner: WinnerResult }) {
  const m = t(resultsText);
  return (
    <li>
      <span class={styles.winnerCard}>
        {winner.cardNo === undefined ? m.prize.noCard : m.prize.card(winner.cardNo)}
      </span>
      {winner.name !== undefined && <span class={styles.winnerExtra}> · {winner.name}</span>}
      {winner.note !== undefined && <span class={styles.muted}> · {winner.note}</span>}
      {winner.validSinceSeq !== undefined && (
        <span class={styles.prizeMeta}>
          {m.prize.validSince(winner.validSinceSeq, winner.validSinceNumber)}
        </span>
      )}
      {winner.late && <span class={styles.flag}>{m.prize.late}</span>}
    </li>
  );
}

function WinnersCell({ prize }: { readonly prize: PrizeResult }) {
  const m = t(resultsText);
  if (prize.status === 'SKIPPED')
    return <span class={styles.muted}>{m.prize.skipped(prize.skipReason ?? '')}</span>;
  if (prize.status === 'OPEN') return <span class={styles.muted}>{m.prize.open}</span>;
  return (
    <>
      <ul class={styles.winners}>
        {prize.winners.map((winner, index) => (
          <WinnerLine key={index} winner={winner} />
        ))}
      </ul>
      {prize.winners.length > 1 && (
        <span class={styles.flag}>{m.prize.shared(prize.winners.length)}</span>
      )}
      {prize.corrections > 0 && (
        <span class={styles.flag}>{m.prize.corrected(prize.corrections)}</span>
      )}
      {prize.tiebreak !== undefined && <TiebreakDetails tiebreak={prize.tiebreak} />}
    </>
  );
}

/** One prize of a round: prize, rule, winning cards, draws needed, handout and correction. */
export function PrizeRow({
  round,
  prize,
  actions,
}: {
  readonly round: number;
  readonly prize: PrizeResult;
  readonly actions: PrizeActions;
}) {
  const m = t(resultsText);
  const c = t(commonText);
  const title = prizeTitle(prize.title, prize.slot, c);
  const meta = [
    prize.valueChf === undefined ? undefined : formatChf(prize.valueChf),
    prize.sponsor === undefined ? undefined : m.prize.sponsor(prize.sponsor),
  ].filter((part) => part !== undefined);
  const collected = prize.handout === 'COLLECTED';
  return (
    <tr>
      <th scope="row">
        <span class={styles.slotLabel}>{c.prizeSlot(prize.slot)}</span>
        {prize.title !== undefined && <span class={styles.prizeTitle}>{prize.title}</span>}
        {meta.length > 0 && <span class={styles.prizeMeta}>{meta.join(' · ')}</span>}
      </th>
      <td>{conditionLabel(prize.condition, c)}</td>
      <td>
        <WinnersCell prize={prize} />
      </td>
      <td class="tabular">
        {prize.drawCount === undefined ? '' : m.prize.afterNumbers(prize.drawCount)}
      </td>
      <td>
        {prize.handout !== undefined && (
          <div class={styles.handout}>
            <span>{m.handout[prize.handout]}</span>
            <button
              type="button"
              class={styles.handoutButton}
              aria-pressed={collected}
              aria-label={m.handout.buttonLabel(title)}
              disabled={!actions.canEdit}
              onClick={() => {
                actions.onHandout(round, prize.slot, collected ? 'OPEN' : 'COLLECTED');
              }}
            >
              {m.handout.button}
            </button>
          </div>
        )}
      </td>
      <td>
        {prize.status === 'AWARDED' && (
          <Button
            aria-label={m.correction.buttonLabel(title)}
            disabled={!actions.canEdit}
            onClick={() => {
              actions.onCorrect(round, prize.slot);
            }}
          >
            {m.correction.button}
          </Button>
        )}
      </td>
    </tr>
  );
}
