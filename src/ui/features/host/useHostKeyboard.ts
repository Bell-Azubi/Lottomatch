import { useEffect, useRef } from 'preact/hooks';
import { openDialogCount } from '../../design-system/Dialog';
import { appendDigit, clearBuffer, manualBuffer, removeDigit } from './manual-buffer';

export interface HostShortcuts {
  readonly spin: () => void;
  readonly commitManual: () => void;
  readonly undo: () => void;
  readonly checkWin: () => void;
  readonly togglePause: () => void;
  readonly openDisplay: () => void;
  readonly fullscreen: () => void;
  readonly help: () => void;
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'number',
  'search',
  'tel',
  'password',
  'email',
  'url',
  'date',
  'time',
]);

/** True while focus is in a field that takes text; shortcuts are inactive then (FR-12). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

/** Maps a key event to a shortcut; returns true when it was handled. */
export function handleHostKey(event: KeyboardEvent, shortcuts: HostShortcuts): boolean {
  if (
    event.defaultPrevented ||
    event.altKey ||
    openDialogCount.value > 0 ||
    isTypingTarget(event.target)
  ) {
    return false;
  }
  const key = event.key;
  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
    if (!event.repeat && !event.shiftKey) shortcuts.undo();
    return true;
  }
  if (event.ctrlKey || event.metaKey) return false;
  if (key === ' ' || key === 'Spacebar') {
    if (!event.repeat) shortcuts.spin();
    return true;
  }
  if (/^\d$/.test(key)) {
    appendDigit(key);
    return true;
  }
  if (key === 'Backspace' && manualBuffer.value !== '') {
    removeDigit();
    return true;
  }
  if (key === 'Enter' && manualBuffer.value !== '') {
    if (!event.repeat) shortcuts.commitManual();
    return true;
  }
  if (key === 'Escape' && manualBuffer.value !== '') {
    clearBuffer();
    return true;
  }
  if (event.repeat) return false;
  const actions: Readonly<Record<string, () => void>> = {
    g: shortcuts.checkWin,
    p: shortcuts.togglePause,
    a: shortcuts.openDisplay,
    f: shortcuts.fullscreen,
    '?': shortcuts.help,
  };
  const action = actions[key.length === 1 ? key.toLowerCase() : key];
  if (action === undefined) return false;
  action();
  return true;
}

/** Installs the host keyboard shortcuts while the host console is mounted. */
export function useHostKeyboard(shortcuts: HostShortcuts): void {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (handleHostKey(event, latest.current)) event.preventDefault();
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, []);
}
