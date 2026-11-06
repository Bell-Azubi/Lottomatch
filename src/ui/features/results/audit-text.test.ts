import { describe, expect, it } from 'vitest';
import { auditEntries } from '../../../application/audit';
import type { LogEvent } from '../../../domain/types';
import { audit as deAudit } from '../../../i18n/de-CH/audit';
import { common as deCommon } from '../../../i18n/de-CH/common';
import { audit as enAudit } from '../../../i18n/en/audit';
import { common as enCommon } from '../../../i18n/en/common';
import { buildLog, EVENING } from '../../../test/results-fixture';
import { cardsText, describeAudit } from './audit-text';

const rules = { maxNumber: 75, perLine: 5, lines: 3, boardReset: 'ROUND' } as const;
const EXTRA: readonly LogEvent[] = [
  { type: 'ROUND_STARTED', round: 3, rules, reason: 'Gang 2 später' },
  { type: 'NUMBER_DRAWN', round: 3, draw: { seq: 1, number: 50, method: 'RANDOM' } },
  { type: 'CLAIM_REJECTED', round: 3, slot: 1, claimed: [50, 1, 2], missing: [], lateSinceSeq: 1 },
  { type: 'WINNER_CORRECTED', round: 3, slot: 1, winners: [{}], reason: '' },
  { type: 'AWARD_REVOKED', round: 3, slot: 2, reason: 'Fehler' },
  { type: 'HANDOUT_CHANGED', round: 3, slot: 1, status: 'OPEN' },
  { type: 'PRIZES_CHANGED', action: 'Bild ersetzt', rounds: [] },
  { type: 'EVENT_COMPLETED' },
];

function sentences(locale: 'de' | 'en'): string[] {
  const [m, c] = locale === 'de' ? [deAudit, deCommon] : [enAudit, enCommon];
  return auditEntries(buildLog([...EVENING, ...EXTRA])).map((entry) => describeAudit(entry, m, c));
}

describe('describeAudit', () => {
  it('renders one de-CH sentence per event type', () => {
    const text = sentences('de');
    expect(text).toContain('Gang 1 gestartet (Zahlen 1–90)');
    expect(text).toContain('5 eingetragen (Ziehung 1)');
    expect(text).toContain('Fehlmeldung, Gang 1, Preis 1: es fehlen 1, 2');
    expect(text).toContain('Gewinn bestätigt, Gang 1, Preis 1: Karte 17');
    expect(text).toContain('Preis übersprungen, Gang 1, Preis 2: Kein Preis vorhanden');
    expect(text).toContain('Ziehung 7 (Zahl 77) rückgängig gemacht');
    expect(text).toContain('Gewinn nach Stechen bestätigt, Gang 1, Preis 3: Karte 30');
    expect(text).toContain('Gewinn widerrufen, Gang 1, Preis 3 (Karte 30): Karte falsch gelesen');
    expect(text).toContain('Gewinn bestätigt, Gang 1, Preis 4: Karte 1, Karte 2');
    expect(text).toContain('Preis abgeholt, Gang 1, Preis 1');
    expect(text).toContain('Gewinnkarte korrigiert, Gang 1, Preis 1: Karte 18 (Tippfehler)');
    expect(text).toContain('Gang 2 abgebrochen: Stromausfall');
    expect(text).toContain('Einstellungen geändert: venue von «» auf «Turnhalle»');
    expect(text).toContain('Preise geändert: Gang kopiert (Gänge 3, 4)');
    expect(text).toContain('PIN zurückgesetzt');
    expect(text).toContain('Namen gelöscht (1 Gewinnkarte)');
    expect(text).toContain('Steuerung von einem anderen Fenster übernommen');
    expect(text).toContain('Zu Gang 3 gesprungen: Gang 2 später');
    expect(text).toContain('50 gezogen (Ziehung 1)');
    expect(text).toContain('Verspätete Meldung abgelehnt, Gang 3, Preis 1: gültig seit Ziehung 1');
    expect(text).toContain('Gewinnkarte korrigiert, Gang 3, Preis 1: ohne Kartennummer');
    expect(text).toContain('Gewinn widerrufen, Gang 3, Preis 2: Fehler');
    expect(text).toContain('Abholung zurückgesetzt, Gang 3, Preis 1');
    expect(text).toContain('Preise geändert: Bild ersetzt');
    expect(text).toContain('Anlass abgeschlossen');
  });

  it('renders English sentences with the same structure', () => {
    const text = sentences('en');
    expect(text).toContain('Round 1 started (numbers 1–90)');
    expect(text).toContain('Win confirmed, round 1, Prize 4: card 1, card 2');
    expect(text).toContain('Draw 7 (number 77) undone');
    expect(text).toHaveLength(EVENING.length + EXTRA.length);
  });

  it('joins card numbers and marks missing ones', () => {
    expect(cardsText([{ cardNo: '4' }, {}], deAudit)).toBe('Karte 4, ohne Kartennummer');
  });
});
