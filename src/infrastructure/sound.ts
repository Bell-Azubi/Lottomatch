import type { SoundCue, SoundPlayer } from '../application/ports';

interface Tone {
  readonly frequency: number;
  readonly start: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly gain: number;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/** Synthesised cues; no audio files are shipped (FR-13). */
export const CUES: Readonly<Record<SoundCue, readonly Tone[]>> = {
  tick: [{ frequency: 1800, start: 0, duration: 0.015, type: 'square', gain: 0.05 }],
  reveal: [
    { frequency: 880, start: 0, duration: 0.6, type: 'sine', gain: 0.18 },
    { frequency: 1320, start: 0, duration: 0.45, type: 'sine', gain: 0.08 },
  ],
  win: [
    { frequency: C5, start: 0, duration: 0.18, type: 'triangle', gain: 0.18 },
    { frequency: E5, start: 0.12, duration: 0.18, type: 'triangle', gain: 0.18 },
    { frequency: G5, start: 0.24, duration: 0.4, type: 'triangle', gain: 0.18 },
  ],
  superlottoWin: [
    { frequency: C5, start: 0, duration: 0.18, type: 'triangle', gain: 0.2 },
    { frequency: E5, start: 0.14, duration: 0.18, type: 'triangle', gain: 0.2 },
    { frequency: G5, start: 0.28, duration: 0.18, type: 'triangle', gain: 0.2 },
    { frequency: C6, start: 0.42, duration: 0.9, type: 'triangle', gain: 0.22 },
    { frequency: G5, start: 0.42, duration: 0.9, type: 'sine', gain: 0.12 },
  ],
  error: [{ frequency: 180, start: 0, duration: 0.25, type: 'sawtooth', gain: 0.08 }],
};

/** Web Audio player; the context is created on first use (after a user gesture). */
export class WebAudioPlayer implements SoundPlayer {
  private context: AudioContext | undefined;

  constructor(private readonly createContext: (() => AudioContext) | undefined) {}

  play(cue: SoundCue): void {
    if (this.createContext === undefined) return;
    try {
      this.context ??= this.createContext();
      const context = this.context;
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      for (const tone of CUES[cue]) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.value = tone.frequency;
        envelope.gain.setValueAtTime(0.0001, now + tone.start);
        envelope.gain.exponentialRampToValueAtTime(tone.gain, now + tone.start + 0.01);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);
        oscillator.connect(envelope).connect(context.destination);
        oscillator.start(now + tone.start);
        oscillator.stop(now + tone.start + tone.duration + 0.02);
      }
    } catch {
      // Audio is a progressive enhancement; failures are silent by design.
    }
  }
}
