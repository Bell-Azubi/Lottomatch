import type { DomainErrorCode } from '../../domain/errors';
import type { WinConditionKind } from '../../domain/types';

/** Shared de-CH copy: shell, glossary, errors and system notices (C5: ss, «…», ’). */
export const common = {
  appName: 'Lottomatch Live',
  clubName: 'FC Laufenburg-Kaisten',
  logoAlt: 'FC Laufenburg-Kaisten',
  skipToContent: 'Zum Inhalt springen',
  loading: 'Lädt …',
  nav: {
    label: 'Hauptnavigation',
    start: 'Start',
    host: 'Spiel',
    prizes: 'Preise',
    results: 'Auswertung',
    settings: 'Einstellungen',
  },
  actions: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    close: 'Schliessen',
    confirm: 'Bestätigen',
    back: 'Zurück',
    retry: 'Erneut versuchen',
    export: 'Exportieren',
    print: 'Drucken',
    reload: 'Neu laden',
  },
  practiceBadge: 'Übung',
  conditions: {
    ONE_LINE: '1 Reihe',
    TWO_LINES: '2 Reihen',
    FULL_CARD: 'Volle Karte',
    CUSTOM: 'Eigene Regel',
  } satisfies Record<WinConditionKind, string>,
  prizeSlot: (slot: number): string => (slot === 5 ? 'Superlotto' : `Preis ${slot}`),
  prizeDisc: (slot: number): string => (slot === 5 ? 'S' : String(slot)),
  prizeOf: (slot: number, total: number): string =>
    slot === 5 ? 'Superlotto' : `Preis ${slot} von ${total}`,
  roundOf: (round: number, total: number): string => `Runde ${round} von ${total}`,
  progress: {
    AWARDED: 'vergeben',
    ACTIVE: 'aktiv',
    UPCOMING: 'offen',
    SKIPPED: 'übersprungen',
  },
  ring: {
    DONE: 'gespielt',
    CURRENT: 'läuft',
    UPCOMING: 'ausstehend',
    ABORTED: 'abgebrochen',
  },
  ringSummary: (done: number, total: number): string => `${done} von ${total} Runden gespielt`,
  mute: 'Ton aus',
  unmute: 'Ton an',
  domainErrors: {
    EVENT_COMPLETED: 'Der Anlass ist abgeschlossen.',
    ROUND_RUNNING: 'Eine Runde läuft noch. Zuerst abschliessen oder abbrechen.',
    NO_ROUND_RUNNING: 'Keine Runde läuft. Zuerst «Runde starten».',
    ROUND_MISMATCH: 'Diese Aktion gehört zu einer anderen Runde.',
    ROUND_OUT_OF_RANGE: 'Diese Runde gibt es nicht.',
    ROUND_ALREADY_COMPLETED: 'Diese Runde ist bereits fertig gespielt.',
    NO_ROUND_LEFT: 'Alle Runden sind gespielt.',
    INVALID_RULES: 'Die Spielregeln sind ungültig. Einstellungen prüfen.',
    NUMBER_OUT_OF_RANGE: 'Die Zahl liegt ausserhalb des Bretts.',
    NUMBER_ALREADY_DRAWN: 'Diese Zahl ist bereits gezogen.',
    POOL_EMPTY: 'Alle Zahlen sind gezogen.',
    SEQUENCE_MISMATCH: 'Die Ziehung passt nicht zum Spielstand. Seite neu laden.',
    NOTHING_TO_UNDO: 'Es gibt keine Ziehung zum Rückgängigmachen.',
    UNDO_BLOCKED:
      'Nach dieser Ziehung wurde bereits ein Gewinn bestätigt oder ein Preis übersprungen.',
    SLOT_MISMATCH: 'Dieser Preis ist nicht aktiv.',
    NO_AWARD_TO_REVOKE: 'Es gibt keinen Gewinn in dieser Runde, der widerrufen werden kann.',
    REVOKE_BLOCKED_BY_DRAWS:
      'Seit dem Gewinn wurde gezogen. Zuerst diese Ziehungen rückgängig machen.',
    PRIZE_NOT_AWARDED: 'Dieser Preis ist nicht vergeben.',
    INVALID_WINNERS: 'Die Angaben zur Gewinnkarte sind ungültig.',
    WINNER_COUNT_MISMATCH: 'Die Anzahl Gewinnkarten darf sich nicht ändern.',
    INVALID_TIEBREAK: 'Das Stechen ist unvollständig.',
    INVALID_CLAIM: 'Die Meldung ist unvollständig.',
    REASON_REQUIRED: 'Bitte einen Grund angeben (höchstens 200 Zeichen).',
    READ_ONLY: 'Dieses Fenster ist schreibgeschützt.',
    NO_EVENT: 'Kein Anlass geöffnet.',
  } satisfies Record<DomainErrorCode | 'READ_ONLY' | 'NO_EVENT', string>,
  alreadyDrawnInRound: (n: number): string => `${n} ist in dieser Runde bereits gezogen.`,
  alreadyDrawnForPrize: (n: number): string => `${n} ist für diesen Preis bereits gezogen.`,
  persistence: {
    saving: (pending: number): string => `Speichert … (${pending})`,
    saved: 'Gespeichert',
    QUOTA: 'Speicher voll: Das Spiel läuft weiter, wird aber nicht gesichert. Jetzt exportieren.',
    UNAVAILABLE: 'Speichern fehlgeschlagen. Neuer Versuch läuft. Jetzt exportieren.',
    UNKNOWN: 'Speichern fehlgeschlagen. Neuer Versuch läuft. Jetzt exportieren.',
    CONFLICT:
      'Ein anderes Fenster hat gespeichert. Dieses Fenster speichert nicht mehr. Bitte neu laden.',
    exportNow: 'Jetzt exportieren',
  },
  storage: {
    bestEffort:
      'Der Browser darf die Daten bei Speichermangel löschen. Vor und nach dem Anlass sichern.',
    memory:
      'Kein dauerhafter Speicher verfügbar (privates Fenster?). Daten gehen beim Schliessen verloren – regelmässig exportieren.',
  },
  control: {
    readOnly: 'Nur Ansicht: Ein anderes Fenster steuert das Spiel.',
    takeOver: 'Steuerung übernehmen',
    taking: 'Übernehme Steuerung …',
  },
  update: {
    ready: 'Update bereit',
    body: 'Eine neue Version ist geladen. Das Spiel bleibt erhalten; die Anzeige lädt mit.',
    apply: 'Jetzt aktualisieren',
  },
  recovery: {
    title: 'Daten können nicht geladen werden',
    body: 'Die gespeicherten Daten sind beschädigt oder stammen aus einer unbekannten Version. Nichts wurde gelöscht.',
    detail: (code: string, seq?: number): string =>
      seq === undefined ? `Fehlercode: ${code}` : `Fehlercode: ${code} (Eintrag ${seq})`,
    exportRaw: 'Rohdaten exportieren',
    reset: 'Alles zurücksetzen',
    resetConfirm: 'Zum Bestätigen «ZURÜCKSETZEN» eintippen',
    resetWord: 'ZURÜCKSETZEN',
  },
  errorBoundary: {
    title: 'Hier ist etwas schiefgelaufen',
    body: 'Das Spiel ist gespeichert. Seite neu laden oder zur Startseite wechseln.',
    toStart: 'Zur Startseite',
  },
  unexpectedError: 'Unerwarteter Fehler. Details unter Einstellungen → Über.',
  pinGate: {
    title: 'PIN eingeben',
    body: 'Diese Seite ist mit einer PIN vor versehentlichen Änderungen geschützt.',
    label: 'PIN',
    submit: 'Entsperren',
    wrong: 'Falsche PIN.',
    forgot: 'PIN vergessen?',
    resetTitle: 'PIN zurücksetzen',
    resetBody:
      'Die PIN wird entfernt; das wird protokolliert. Die PIN schützt nur vor Versehen, nicht vor Absicht.',
    resetConfirm: 'Zum Bestätigen «PIN ENTFERNEN» eintippen',
    resetWord: 'PIN ENTFERNEN',
    reset: 'PIN entfernen',
  },
};

export type CommonMessages = typeof common;
