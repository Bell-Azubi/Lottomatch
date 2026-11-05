import { settingsData as deData } from '../../../i18n/de-CH/settings-data';
import { settings as deSettings } from '../../../i18n/de-CH/settings';
import { settingsData as enData } from '../../../i18n/en/settings-data';
import { settings as enSettings } from '../../../i18n/en/settings';
import type { SettingsDataMessages } from '../../../i18n/de-CH/settings-data';
import type { SettingsMessages } from '../../../i18n/de-CH/settings';
import type { Localised } from '../../../i18n';

/** Feature catalogues of Einstellungen; loaded with the lazy settings chunk only. */
export const settingsText: Localised<SettingsMessages> = { 'de-CH': deSettings, en: enSettings };
export const settingsDataText: Localised<SettingsDataMessages> = { 'de-CH': deData, en: enData };
