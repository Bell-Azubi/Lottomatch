/** Badge colours only: Gold, Cream and Red (design plan review item 7). */
const COLOURS = ['#F8B708', '#FFFBE6', '#C3071B'];

/**
 * Award celebration with canvas-confetti, loaded lazily. A dedicated canvas without a worker keeps
 * the CSP (`worker-src 'self'` forbids blob workers). Returns a cleanup function.
 */
export async function celebrate(main: boolean, canvasClass: string): Promise<() => void> {
  const { default: confetti } = await import('canvas-confetti');
  const canvas = document.createElement('canvas');
  canvas.className = canvasClass;
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const fire = confetti.create(canvas, {
    resize: true,
    useWorker: false,
    disableForReducedMotion: true,
  });
  const base = { colors: COLOURS, ticks: main ? 320 : 220, scalar: main ? 1.4 : 1.1 };
  void fire({
    ...base,
    particleCount: main ? 220 : 110,
    spread: main ? 120 : 80,
    startVelocity: main ? 58 : 42,
    origin: { y: 0.65 },
  });
  const timers: ReturnType<typeof setTimeout>[] = [];
  if (main) {
    timers.push(
      setTimeout(() => {
        void fire({ ...base, particleCount: 120, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
        void fire({
          ...base,
          particleCount: 120,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.7 },
        });
      }, 420),
    );
  }
  return () => {
    for (const timer of timers) clearTimeout(timer);
    fire.reset();
    canvas.remove();
  };
}
