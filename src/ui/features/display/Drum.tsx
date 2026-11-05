import { useEffect, useRef } from 'preact/hooks';
import { BadgeRing } from '../../design-system/BadgeRing';
import styles from './Stage.module.css';

interface Ball {
  readonly orbit: number;
  readonly phase: number;
  readonly speed: number;
  readonly wobble: number;
  readonly size: number;
}

/** Deterministic pseudo-random sequence for the cosmetic tumbling (never used for draws). */
function sequence(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

function createBalls(count: number, seed: number): Ball[] {
  const next = sequence(seed);
  return Array.from({ length: count }, () => ({
    orbit: 0.18 + next() * 0.52,
    phase: next() * Math.PI * 2,
    speed: 1.6 + next() * 2.4,
    wobble: next() * Math.PI * 2,
    size: 0.075 + next() * 0.025,
  }));
}

function drawFrame(
  context: CanvasRenderingContext2D,
  size: number,
  balls: readonly Ball[],
  time: number,
): void {
  const center = size / 2;
  context.clearRect(0, 0, size, size);
  const glass = context.createRadialGradient(
    center,
    center * 0.8,
    size * 0.05,
    center,
    center,
    size / 2,
  );
  glass.addColorStop(0, 'rgba(255, 251, 230, 0.10)');
  glass.addColorStop(1, 'rgba(30, 30, 33, 0.55)');
  context.fillStyle = glass;
  context.beginPath();
  context.arc(center, center, size * 0.47, 0, Math.PI * 2);
  context.fill();
  for (const ball of balls) {
    const angle = ball.phase + time * ball.speed;
    const radius = ball.orbit * size * 0.5 * (0.85 + 0.15 * Math.sin(time * 3 + ball.wobble));
    const x = center + Math.cos(angle) * radius;
    const y =
      center + Math.sin(angle) * radius * 0.92 + size * 0.04 * Math.sin(time * 5 + ball.wobble);
    const r = ball.size * size;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fillStyle = '#F8B708';
    context.fill();
    context.lineWidth = Math.max(1, r * 0.12);
    context.strokeStyle = '#FFFBE6';
    context.stroke();
    context.beginPath();
    context.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.55)';
    context.fill();
  }
  const frost = context.createLinearGradient(0, 0, size, size);
  frost.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  frost.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
  frost.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
  context.fillStyle = frost;
  context.beginPath();
  context.arc(center, center, size * 0.47, 0, Math.PI * 2);
  context.fill();
}

/**
 * Frosted-glass drum with softly tumbling gold balls. It animates only while mounted (during a
 * spin); requestAnimationFrame pauses by itself while the window is hidden.
 */
export function Drum({ seed }: { readonly seed: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (element === null || context === null || context === undefined) return undefined;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.max(1, Math.round(element.clientWidth * ratio));
    element.width = size;
    element.height = size;
    const balls = createBalls(14, seed);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      drawFrame(context, size, balls, (now - start) / 1_000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [seed]);
  return (
    <div class={styles.drum} aria-hidden="true">
      <canvas ref={canvas} class={styles.drumCanvas} />
      <span class={styles.drumRing}>
        <BadgeRing variant="ring" />
      </span>
    </div>
  );
}
