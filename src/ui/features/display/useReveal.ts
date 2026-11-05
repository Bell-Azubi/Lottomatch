import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { DisplaySnapshot } from '../../../application/sync-messages';
import { EASE_OUT, finishAll, play, prefersReducedMotion, SPRING, wait } from './motion';

export type RevealPhase = 'IDLE' | 'DRUM' | 'LANDING';

interface ShownDraw {
  readonly number: number;
  readonly seq: number;
}

export interface RevealView {
  readonly phase: RevealPhase;
  /** The draw the badge shows. */
  readonly shown: ShownDraw | undefined;
  /** Number still flying in; the board shows it once it has landed. */
  readonly pending: number | undefined;
  readonly drumSeed: number;
}

const IDLE: RevealView = { phase: 'IDLE', shown: undefined, pending: undefined, drumSeed: 1 };

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/** Ring-by-ring badge assembly after the ball lands: ≤ 450 ms in total. */
async function assemble(stage: HTMLElement | null, running: Set<Animation>): Promise<void> {
  const layer = (name: string) =>
    stage?.querySelector(`[data-reveal="badge"] [data-layer="${name}"]`);
  const fadeIn = (name: string, delay: number, duration: number) =>
    play(
      layer(name),
      [
        { opacity: 0, transform: 'scale(1.08)' },
        { opacity: 1, transform: 'none' },
      ],
      { delay, duration, easing: EASE_OUT },
      running,
    );
  await Promise.all([
    play(
      layer('core'),
      [{ transform: 'translateY(30%) scale(0.18)' }, { transform: 'none' }],
      { duration: 300, easing: SPRING },
      running,
    ),
    fadeIn('creamHairline', 120, 120),
    fadeIn('band', 160, 150),
    fadeIn('whiteHairline', 230, 120),
    fadeIn('rim', 290, 150),
  ]);
}

/** FLIP: a small gold disc flies from the badge into the number's board cell. */
async function flyToCell(
  stage: HTMLElement | null,
  board: HTMLElement | null,
  number: number,
  flyerClass: string,
  running: Set<Animation>,
): Promise<void> {
  const source = stage?.querySelector('[data-reveal="badge"]');
  const target = board?.querySelector(`[data-number="${number}"]`);
  if (source === null || source === undefined || target === null || target === undefined) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const flyer = document.createElement('span');
  flyer.className = flyerClass;
  flyer.setAttribute('aria-hidden', 'true');
  flyer.style.left = `${to.left}px`;
  flyer.style.top = `${to.top}px`;
  flyer.style.width = `${to.width}px`;
  flyer.style.height = `${to.height}px`;
  document.body.append(flyer);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = Math.max(1, (from.width * 0.3) / Math.max(1, to.width));
  try {
    await play(
      flyer,
      [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: 'none' }],
      { duration: 320, easing: EASE_OUT },
      running,
    );
  } finally {
    flyer.remove();
  }
}

/**
 * Display-side reveal of the newest draw: drum (spin duration), ball rolls out and grows into the
 * badge, rings assemble, then a disc flies into the board (FLIP). Reduced motion crossfades in
 * ≤ 200 ms; "Aus" and late or reloaded windows show the result at once. Cosmetic only: the draw
 * is fixed before any of this starts.
 */
export function useReveal(
  snapshot: DisplaySnapshot | undefined,
  stage: RefObject<HTMLElement>,
  board: RefObject<HTMLElement>,
  flyerClass: string,
): RevealView {
  const [view, setView] = useState<RevealView>(IDLE);
  const current = useRef(view);
  const running = useRef(new Set<Animation>());
  const sequence = useRef(0);
  const lastKey = useRef<string | undefined>(undefined);
  const started = useRef(false);
  const timer = useRef<{ cancel: () => void } | undefined>(undefined);

  const update = (next: RevealView) => {
    current.current = next;
    setView(next);
  };

  useEffect(() => {
    if (snapshot === undefined) return;
    const latest = snapshot.latest;
    const reveal = snapshot.reveal;
    const settle = (shown: ShownDraw | undefined) => {
      sequence.current += 1;
      timer.current?.cancel();
      finishAll(running.current);
      update({ ...current.current, phase: 'IDLE', shown, pending: undefined });
    };
    if (!started.current || latest === undefined) {
      started.current = true;
      lastKey.current = reveal?.key;
      settle(latest);
      return;
    }
    if (reveal === undefined || reveal.key === lastKey.current) {
      const { pending, shown } = current.current;
      const pendingGone = pending !== undefined && !snapshot.drawn.includes(pending);
      const revealedNow = reveal?.instant === true && pending !== undefined;
      const changed =
        pending === undefined && (shown?.number !== latest.number || shown.seq !== latest.seq);
      if (pendingGone || revealedNow || changed) settle(latest);
      return;
    }
    lastKey.current = reveal.key;
    if (reveal.instant || snapshot.animation === 'OFF') {
      settle(latest);
      return;
    }
    sequence.current += 1;
    const id = sequence.current;
    timer.current?.cancel();
    finishAll(running.current);
    const alive = () => sequence.current === id;
    const badge = () => stage.current?.querySelector('[data-reveal="badge"]');
    void (async () => {
      if (prefersReducedMotion()) {
        await play(badge(), [{ opacity: 1 }, { opacity: 0 }], { duration: 90 }, running.current);
        if (!alive()) return;
        update({ ...current.current, phase: 'IDLE', shown: latest, pending: undefined });
        await nextFrame();
        await play(badge(), [{ opacity: 0 }, { opacity: 1 }], { duration: 90 }, running.current);
        return;
      }
      const drumSeed = latest.seq * 31 + latest.number;
      if (reveal.durationMs > 0) {
        update({ ...current.current, phase: 'DRUM', pending: latest.number, drumSeed });
        const pause = wait(reveal.durationMs);
        timer.current = pause;
        await pause.promise;
        if (!alive()) return;
      }
      update({ ...current.current, phase: 'LANDING', shown: latest, pending: latest.number });
      await nextFrame();
      if (!alive()) return;
      await assemble(stage.current, running.current);
      if (!alive()) return;
      await flyToCell(stage.current, board.current, latest.number, flyerClass, running.current);
      if (!alive()) return;
      update({ ...current.current, phase: 'IDLE', shown: latest, pending: undefined });
    })();
  }, [snapshot, stage, board, flyerClass]);

  useEffect(() => {
    const animations = running.current;
    return () => {
      sequence.current += 1;
      timer.current?.cancel();
      finishAll(animations);
    };
  }, []);

  return view;
}
