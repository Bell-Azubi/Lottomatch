import { signal } from '@preact/signals';

export type Locale = 'de-CH' | 'en';

export const LOCALES: readonly Locale[] = ['de-CH', 'en'];

/** The UI language; de-CH is the default (C5). */
export const locale = signal<Locale>('de-CH');

/** A typed message catalogue per locale; every locale must implement the same shape. */
export type Localised<T> = Readonly<Record<Locale, T>>;

/**
 * Returns the catalogue of the current locale. Reading the locale signal inside a component's
 * render subscribes it, so the UI re-renders when the language changes.
 */
export function t<T>(catalogue: Localised<T>): T {
  return catalogue[locale.value];
}
