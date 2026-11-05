/** Motion helpers for the display: Web Animations API only, so everything is cancellable. */

/** Spring easing with a cubic-bezier fallback where `linear()` is unsupported (Safari 16.4). */
export const SPRING =
  typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)')
    ? 'linear(0, 0.035 2.1%, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.077, 1.149 27.2%, 1.159 30.6%, 1.088 42.3%, 1.024 50.5%, 0.987, 0.998 79.6%, 1)'
    : 'cubic-bezier(0.34, 1.36, 0.64, 1)';

export const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** True when the user asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Runs an animation and resolves when it finishes or is cancelled; no-op without WAAPI. */
export function play(
  element: Element | null | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  running: Set<Animation>,
): Promise<void> {
  if (element === null || element === undefined || typeof element.animate !== 'function')
    return Promise.resolve();
  const animation = element.animate(keyframes, { fill: 'both', ...options });
  running.add(animation);
  return animation.finished.then(
    () => {
      running.delete(animation);
    },
    () => {
      running.delete(animation);
    },
  );
}

/** Jumps every running animation to its end state. */
export function finishAll(running: Set<Animation>): void {
  for (const animation of [...running]) {
    try {
      animation.finish();
    } catch {
      animation.cancel();
    }
  }
  running.clear();
}

/** Promise-based timeout that can be cancelled through the returned function. */
export function wait(ms: number): { promise: Promise<void>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveWait: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolveWait = resolve;
    timer = setTimeout(resolve, ms);
  });
  return {
    promise,
    cancel: () => {
      if (timer !== undefined) clearTimeout(timer);
      resolveWait();
    },
  };
}
