import type { MatchSettings } from '../domain/settings';
import type { Prize } from '../domain/types';

export type MatchKind = 'REAL' | 'PRACTICE';

/** A Lottomatch event as stored on this device. */
export interface MatchRecord {
  readonly id: string;
  readonly kind: MatchKind;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archived: boolean;
  readonly settings: MatchSettings;
  /** Increments on every settings change (versioned document). */
  readonly settingsVersion: number;
  readonly lastBackupAt?: string;
  /** The event a practice or duplicated event was created from. */
  readonly sourceMatchId?: string;
}

/** The prize catalogue of one event (versioned document). */
export interface CatalogueRecord {
  readonly matchId: string;
  readonly version: number;
  readonly prizes: readonly Prize[];
}

export interface StoredImage {
  readonly id: string;
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly createdAt: string;
}

export type ThemeChoice = 'SYSTEM' | 'DARK' | 'LIGHT';
export type AnimationSpeed = 'OFF' | 'SHORT' | 'NORMAL' | 'THRILL';
export type LocaleChoice = 'de-CH' | 'en';

/** Device-level presentation preferences (projector specific). */
export interface Preferences {
  readonly locale: LocaleChoice;
  readonly hostTheme: ThemeChoice;
  readonly displayTheme: ThemeChoice;
  readonly animation: AnimationSpeed;
  readonly performanceMode: boolean;
  readonly sound: boolean;
  readonly muted: boolean;
  readonly voice: boolean;
  readonly voiceDigits: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  locale: 'de-CH',
  hostTheme: 'SYSTEM',
  displayTheme: 'DARK',
  animation: 'NORMAL',
  performanceMode: false,
  sound: false,
  muted: false,
  voice: false,
  voiceDigits: true,
};

/** Spin duration per animation setting (FR-2). */
export const SPIN_DURATION_MS: Readonly<Record<AnimationSpeed, number>> = {
  OFF: 0,
  SHORT: 800,
  NORMAL: 1800,
  THRILL: 3000,
};

/** Salted PIN hash; the PIN is a guard against accidents, not a security boundary. */
export interface PinRecord {
  readonly salt: string;
  readonly hash: string;
  readonly iterations: number;
}

/** Device-level metadata, keyed by name. */
export interface MetaRecords {
  readonly preferences: Preferences;
  readonly activeMatchId: string;
  readonly pin: PinRecord;
  /** Increments whenever a window takes control; orders sync snapshots across hosts. */
  readonly hostEpoch: number;
}
