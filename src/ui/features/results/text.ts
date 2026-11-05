import { audit as deAudit, type AuditMessages } from '../../../i18n/de-CH/audit';
import { results as deResults, type ResultsMessages } from '../../../i18n/de-CH/results';
import { audit as enAudit } from '../../../i18n/en/audit';
import { results as enResults } from '../../../i18n/en/results';
import type { Localised } from '../../../i18n';

/** Catalogues of the Auswertung page; loaded with its chunk. */
export const resultsText: Localised<ResultsMessages> = { 'de-CH': deResults, en: enResults };
export const auditText: Localised<AuditMessages> = { 'de-CH': deAudit, en: enAudit };
