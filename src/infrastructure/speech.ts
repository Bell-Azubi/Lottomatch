import type { Announcer } from '../application/ports';

/** Picks a German voice: de-CH first, then de-DE, then any German voice. */
export function pickGermanVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const normalised = (voice: SpeechSynthesisVoice) => voice.lang.replace('_', '-').toLowerCase();
  return (
    voices.find((v) => normalised(v) === 'de-ch') ??
    voices.find((v) => normalised(v) === 'de-de') ??
    voices.find((v) => normalised(v).startsWith('de'))
  );
}

/**
 * Text for a number, optionally followed by its digits ("42 – 4, 2"), because sechzehn/sechzig
 * and siebzehn/siebzig blur in a loud hall. The voice reads the numerals in German.
 */
export function announcementText(number: number, withDigits: boolean): string {
  if (!withDigits || number < 10) return String(number);
  return `${number} – ${String(number).split('').join(', ')}`;
}

/** Web Speech announcer (Could); a progressive enhancement. */
export class SpeechAnnouncer implements Announcer {
  readonly supported: boolean;
  private voice: SpeechSynthesisVoice | undefined;

  constructor(private readonly synth: SpeechSynthesis | undefined) {
    this.supported = synth !== undefined;
    if (synth === undefined) return;
    const refresh = () => {
      this.voice = pickGermanVoice(synth.getVoices());
    };
    refresh();
    synth.addEventListener('voiceschanged', refresh);
  }

  announce(number: number, withDigits: boolean): void {
    if (this.synth === undefined) return;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(announcementText(number, withDigits));
    utterance.lang = this.voice?.lang ?? 'de-CH';
    if (this.voice !== undefined) utterance.voice = this.voice;
    utterance.rate = 0.9;
    this.synth.speak(utterance);
  }

  cancel(): void {
    this.synth?.cancel();
  }
}
