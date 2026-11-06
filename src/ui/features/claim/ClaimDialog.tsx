import type { ClaimantInput } from '../../../application/host-controller';
import { activePrizeView, cardWonEarlier } from '../../../application/selectors';
import { uniformNumber } from '../../../domain/random';
import { activePool } from '../../../domain/state';
import { claimText, commonText } from '../../../i18n/catalogues';
import { conditionLabel, prizeTitle } from '../../../i18n/labels';
import { t } from '../../../i18n';
import { useHostServices } from '../../app/context';
import { Dialog } from '../../design-system/Dialog';
import { showToast } from '../../design-system/toast-store';
import { errorMessage } from '../host/error-message';
import { ConfirmWin } from './ConfirmWin';
import styles from './Claim.module.css';

/**
 * Gewinn prüfen: the Kontrolle checks the card at the table, the host confirms the win here. Draw
 * controls are locked while it is open (modal dialog, shortcuts inactive). Several cards go to
 * Stechen or Teilen (FR-6, FR-7, ADR-0025).
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
  const session = app.session.value;
  const game = session?.game.value;
  const pool = game === undefined ? undefined : activePool(game);
  const view =
    session === undefined || game === undefined
      ? undefined
      : activePrizeView(game, session.catalogue.value, session.match.value.settings);
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
  const confirm = (input: ClaimantInput) => {
    const result = host.award(input);
    if (!result.ok) {
      showToast(errorMessage(result.error), { tone: 'error' });
      return;
    }
    showToast(m.confirmed, { tone: 'success' });
    onClose();
  };
  const title = `${m.confirm}: ${prizeTitle(view.prize?.title, view.slot, c)} · ${conditionLabel(view.condition, c)}`;
  return (
    <Dialog open={open} title={title} onClose={onClose} size="lg">
      <p class={styles.hint}>{m.drawLocked}</p>
      <ConfirmWin
        tiePolicy={settings.tiePolicy}
        tiebreakOrder={settings.tiebreakOrder}
        drawTiebreakNumber={() =>
          uniformNumber(pool.rules.maxNumber, () => app.platform.random.nextUint32())
        }
        wonEarlier={(cardNo) => cardWonEarlier(game, view.round, cardNo)}
        onCancel={onClose}
        onConfirm={confirm}
      />
    </Dialog>
  );
}
