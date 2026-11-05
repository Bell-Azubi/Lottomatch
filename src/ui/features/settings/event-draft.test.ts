import { describe, expect, it } from 'vitest';
import { defaultSettings, validateSettings, type SettingsIssue } from '../../../domain/settings';
import { settings as de } from '../../../i18n/de-CH/settings';
import {
  draftFromSettings,
  issueText,
  messagesByField,
  parseWholeNumber,
  settingsFromDraft,
} from './event-draft';

const base = {
  ...defaultSettings('Lottomatch', '2026-11-07'),
  template: {
    ...defaultSettings('x').template,
    2: { kind: 'CUSTOM' as const, label: 'Ecken' },
  },
  sponsors: ['Bäckerei', 'Garage'],
  payout: { enabled: true, stakesChf: 4500.5, minRatioPercent: 60 },
};

describe('event draft conversion', () => {
  it('round-trips settings through the form state', () => {
    const draft = draftFromSettings(base);
    expect(draft.rounds).toBe('24');
    expect(draft.template[2]).toEqual({ kind: 'CUSTOM', label: 'Ecken' });
    expect(draft.template[1]).toEqual({ kind: 'ONE_LINE', label: '' });
    expect(draft.sponsors).toBe('Bäckerei\nGarage');
    expect(draft.stakes).toBe('4500.50');
    expect(draft.prizeReset).toBe(false);
    const back = settingsFromDraft(draft, base);
    expect(back.issues).toEqual([]);
    expect(back.settings).toEqual(base);
  });

  it('parses Swiss CHF input and whole numbers', () => {
    const draft = {
      ...draftFromSettings(base),
      stakes: "4'000.–",
      rounds: ' 12 ',
      prizeReset: true,
    };
    const { settings, issues } = settingsFromDraft(draft, base);
    expect(issues).toEqual([]);
    expect(settings.payout.stakesChf).toBe(4000);
    expect(settings.rounds).toBe(12);
    expect(settings.boardReset).toBe('PRIZE');
    expect(draftFromSettings({ ...base, payout: { ...base.payout, stakesChf: 4000 } }).stakes).toBe(
      '4000',
    );
  });

  it('turns unparseable input into validation issues', () => {
    expect(parseWholeNumber('4.5')).toBeNaN();
    expect(parseWholeNumber('abc')).toBeNaN();
    const draft = { ...draftFromSettings(base), stakes: 'viel', maxNumber: 'neunzig' };
    const { settings, issues } = settingsFromDraft(draft, base);
    expect(issues).toEqual([{ field: 'payout', code: 'OUT_OF_RANGE' }]);
    expect(settings.payout.stakesChf).toBeUndefined();
    expect(validateSettings(settings)).toContainEqual({ field: 'maxNumber', code: 'OUT_OF_RANGE' });
  });

  it('drops stakes when the field is empty', () => {
    const { settings } = settingsFromDraft({ ...draftFromSettings(base), stakes: ' ' }, base);
    expect(settings.payout).toEqual({ enabled: true, minRatioPercent: 60 });
  });
});

describe('issue messages', () => {
  const all: readonly SettingsIssue[] = [
    { field: 'name', code: 'REQUIRED' },
    { field: 'name', code: 'TOO_LONG' },
    { field: 'venue', code: 'TOO_LONG' },
    { field: 'date', code: 'INVALID_DATE' },
    { field: 'rounds', code: 'OUT_OF_RANGE' },
    { field: 'rounds', code: 'BELOW_PLAYED_ROUND' },
    { field: 'maxNumber', code: 'OUT_OF_RANGE' },
    { field: 'maxNumber', code: 'LOCKED_WHILE_RUNNING' },
    { field: 'perLine', code: 'OUT_OF_RANGE' },
    { field: 'perLine', code: 'LOCKED_WHILE_RUNNING' },
    { field: 'lines', code: 'OUT_OF_RANGE' },
    { field: 'lines', code: 'LOCKED_WHILE_RUNNING' },
    { field: 'cardSize', code: 'CARD_TOO_LARGE' },
    { field: 'boardReset', code: 'LOCKED_WHILE_RUNNING' },
    { field: 'template', code: 'INVALID_CONDITION' },
    { field: 'sponsors', code: 'TOO_MANY' },
    { field: 'sponsors', code: 'TOO_LONG' },
    { field: 'payout', code: 'OUT_OF_RANGE' },
  ];

  it('has a specific message for every issue', () => {
    const texts = all.map((issue) => issueText(issue, de, 7));
    expect(texts.every((text) => text.length > 0)).toBe(true);
    expect(texts[5]).toBe('Mindestens 7: so viele Runden wurden schon gestartet.');
    expect(texts[7]).toBe('Gesperrt, solange eine Runde läuft.');
    expect(texts.join(' ')).not.toContain('ß');
  });

  it('keeps the first message per field', () => {
    const byField = messagesByField(all, de, 7);
    expect(byField.name).toBe(de.issues.name.REQUIRED);
    expect(byField.rounds).toBe(de.issues.rounds.OUT_OF_RANGE);
    expect(Object.keys(byField)).toHaveLength(12);
  });
});
