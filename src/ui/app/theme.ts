import type { ThemeChoice } from '../../application/records';

/** Applies a theme choice to the document (`SYSTEM` follows the operating system). */
export function applyTheme(theme: ThemeChoice): void {
  const root = document.documentElement;
  if (theme === 'SYSTEM') delete root.dataset['theme'];
  else root.dataset['theme'] = theme === 'DARK' ? 'dark' : 'light';
}
