import { claim as deClaim, type ClaimMessages } from './de-CH/claim';
import { common as deCommon, type CommonMessages } from './de-CH/common';
import { display as deDisplay, type DisplayMessages } from './de-CH/display';
import { live as deLive, type LiveMessages } from './de-CH/live';
import { start as deStart, type StartMessages } from './de-CH/start';
import { claim as enClaim } from './en/claim';
import { common as enCommon } from './en/common';
import { display as enDisplay } from './en/display';
import { live as enLive } from './en/live';
import { start as enStart } from './en/start';
import type { Localised } from './index';

/** Core catalogues loaded with the shell; feature pages bring their own lazily. */
export const commonText: Localised<CommonMessages> = { 'de-CH': deCommon, en: enCommon };
export const liveText: Localised<LiveMessages> = { 'de-CH': deLive, en: enLive };
export const claimText: Localised<ClaimMessages> = { 'de-CH': deClaim, en: enClaim };
export const displayText: Localised<DisplayMessages> = { 'de-CH': deDisplay, en: enDisplay };
export const startText: Localised<StartMessages> = { 'de-CH': deStart, en: enStart };
