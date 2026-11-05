import { useState } from 'preact/hooks';
import type { ClaimantInput } from '../../../application/host-controller';
import { activePrizeView, cardWonEarlier, poolNumbers } from '../../../application/selectors';
import { uniformNumber } from '../../../domain/random';
import { activePool } from '../../../domain/state';
import { claimText, commonText } from '../../../i18n/catalogues';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { showToast } from '../../design-system/toast-store';
import { errorMessage } from '../host/error-message';
import { ClaimCheck } from './ClaimCheck';
import type { AdmittedCard } from './claim-model';
import { ConfirmWin } from './ConfirmWin';
import styles from './Claim.module.css';

type Step = 'CHECK' | 'CONFIRM';

/**
 * Gewinn prüfen: draw controls are locked while open (modal dialog, shortcuts inactive). Several
 * cards can be checked; valid ones go to Gewinn bestätigen with Stechen or Teilen (FR-6, FR-7).
 */
export function ClaimDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const m = t(claimText);
  const c = t(commonText);
  const { app, host } = useHostServices();
  const [step, setStep] = useState<Step>('CHECK');
  const [cards, setCards] = useState<readonly AdmittedCard[]>([]);
  const [checkKey, setCheckKey] = useState(0);
  const session = app.session.value;
  const game = session?.game.value;
  const pool = game === undefined ? undefined : activePool(game);
  const view =
    session === undefined || game === undefined
      ? undefined
      : activePrizeView(game, session.catalogue.value, session.match.value.settings);
  const close = () => {
    setStep('CHECK');
    setCards([]);
    setCheckKey((key) => key + 1);
    onClose();
  };
  if (
    !open ||
    session === undefined ||
    game === undefined ||
    pool === undefined ||
    view === undefined
  ) {
    return null;
  }
  const settings = session.match.value.settings;
  const admit = (cardNo: string, validSinceSeq: number | undefined, confirmNow: boolean) => {
    const card: AdmittedCard = {
      id: Date.now() + cards.length,
      cardNo: cardNo.trim(),
      ...(validSinceSeq === undefined ? {} : { validSinceSeq }),
    };
    setCards([...cards, card]);
    setCheckKey((key) => key + 1);
    if (confirmNow) setStep('CONFIRM');
  };
  const reject = (
    claimed: readonly number[],
    missing: readonly number[],
    lateSinceSeq?: number,
  ) => {
    const result = host.rejectClaim(claimed, missing, lateSinceSeq);
    if (!result.ok) {
      showToast(errorMessage(result.error), { tone: 'error' });
      return;
    }
    showToast(m.invalid, { tone: 'info' });
    if (cards.length === 0) close();
    else setCheckKey((key) => key + 1);
  };
  const confirm = (input: ClaimantInput) => {
    const result = host.award(input);
    if (!result.ok) {
      showToast(errorMessage(result.error), { tone: 'error' });
      return;
    }
    showToast(m.confirmed, { tone: 'success' });
    close();
  };
  const title = `${m.title}: ${prizeTitle(view.prize?.title, view.slot, c)} · ${conditionLabel(view.condition, c)}`;
  return (
    <Dialog open={open} title={title} onClose={close} size="lg">
      <p class={styles.hint}>{m.drawLocked}</p>
      {cards.length > 0 && (
        <ul class={styles.admitted}>
          {cards.map((card, index) => (
            <li key={card.id}>
              {m.claimant(index + 1)}
              {card.cardNo === '' ? '' : ` (${card.cardNo})`} · {m.valid}
            </li>
          ))}
        </ul>
      )}
      {step === 'CHECK' ? (
        <>
          <ClaimCheck
            key={checkKey}
            pool={poolNumbers(game)}
            expected={view.expectedCount}
            maxNumber={pool.rules.maxNumber}
            policy={settings.lateClaimPolicy}
            cardIndex={cards.length + 1}
            onAdmit={admit}
            onReject={reject}
          />
          <div class={styles.verdictActions}>
            <Button onClick={close}>{c.actions.cancel}</Button>
            {cards.length > 0 ? (
              <Button
                variant="primary"
                onClick={() => {
                  setStep('CONFIRM');
                }}
              >
                {m.confirm}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  admit('', undefined, true);
                }}
              >
                {m.confirmWithoutCheck}
              </Button>
            )}
          </div>
        </>
      ) : (
        <ConfirmWin
          cards={cards}
          tiePolicy={settings.tiePolicy}
          tiebreakOrder={settings.tiebreakOrder}
          drawTiebreakNumber={() =>
            uniformNumber(pool.rules.maxNumber, () => app.platform.random.nextUint32())
          }
          wonEarlier={(cardNo) => cardWonEarlier(game, view.round, cardNo)}
          onAddCard={() => {
            setStep('CHECK');
          }}
          onBack={() => {
            setStep('CHECK');
          }}
          onConfirm={confirm}
        />
      )}
    </Dialog>
  );
}
