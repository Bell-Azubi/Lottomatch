import type { Localised } from '../../../i18n';
import { prizes as dePrizes, type PrizesMessages } from '../../../i18n/de-CH/prizes';
import { prizes as enPrizes } from '../../../i18n/en/prizes';

/** Catalogue of the Preise page; loaded with the lazy chunk. */
export const prizesText: Localised<PrizesMessages> = { 'de-CH': dePrizes, en: enPrizes };
