import { useEffect, useState } from 'preact/hooks';

/** The cursor hides after this long without movement (FR-10). */
export const CURSOR_IDLE_MS = 3_000;

/**
 * Display window chrome: hides the cursor after 3 s without movement, F toggles fullscreen and a
 * click enters fullscreen where the browser requires user activation.
 */
export function useDisplayChrome(
  toggleFullscreen: () => Promise<void>,
  isFullscreen: () => boolean,
) {
  const [cursorHidden, setCursorHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(isFullscreen);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setCursorHidden(false);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        setCursorHidden(true);
      }, CURSOR_IDLE_MS);
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'f' &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    const onFullscreen = () => {
      setFullscreen(isFullscreen());
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [toggleFullscreen, isFullscreen]);
  return { cursorHidden, fullscreen };
}
