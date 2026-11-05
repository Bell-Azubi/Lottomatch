import type { ActionError } from '../../../application/host-controller';
import { commonText } from '../../../i18n/catalogues';
import { t } from '../../../i18n';

/** Message for a failed host action; says what happened and what to do. */
export function errorMessage(error: ActionError, poolMode: 'ROUND' | 'PRIZE' = 'ROUND'): string {
  const m = t(commonText);
  if (error.code === 'NUMBER_ALREADY_DRAWN' && error.number !== undefined) {
    return poolMode === 'PRIZE'
      ? m.alreadyDrawnForPrize(error.number)
      : m.alreadyDrawnInRound(error.number);
  }
  return m.domainErrors[error.code];
}
