/** de-CH copy for the audit-log viewer: categories and one sentence per event type. */
export const audit = {
  title: 'Protokoll',
  intro:
    'Jede Ziehung, jeder Gewinn und jeder Eingriff wird hier festgehalten; nichts wird gelöscht.',
  category: 'Kategorie',
  round: 'Gang',
  allCategories: 'Alle Kategorien',
  allRounds: 'Alle Gänge',
  roundOption: (round: number): string => `Gang ${round}`,
  categories: {
    DRAWS: 'Ziehungen',
    CLAIMS: 'Gewinne und Fehlmeldungen',
    CORRECTIONS: 'Korrekturen und Widerrufe',
    OVERRIDES: 'Eingriffe der Spielleitung',
    DOCUMENTS: 'Einstellungen und Preise',
    SYSTEM: 'System',
  },
  count: (shown: number, total: number): string => `${shown} von ${total} Einträgen`,
  more: 'Weitere Einträge anzeigen',
  empty: 'Keine Einträge für diese Auswahl.',
  entry: (seq: number): string => `Nr. ${seq}`,
  prize: (round: number, slot: string): string => `Gang ${round}, ${slot}`,
  card: (cardNo: string): string => `Karte ${cardNo}`,
  noCard: 'ohne Kartennummer',
  events: {
    roundStarted: (round: number, max: number): string =>
      `Gang ${round} gestartet (Zahlen 1–${max})`,
    roundJumped: (round: number, reason: string): string =>
      `Zu Gang ${round} gesprungen: ${reason}`,
    numberDrawn: (number: number, seq: number, manual: boolean): string =>
      manual ? `${number} eingetragen (Ziehung ${seq})` : `${number} gezogen (Ziehung ${seq})`,
    drawUndone: (seq: number, number: number | undefined): string =>
      number === undefined
        ? `Ziehung ${seq} rückgängig gemacht`
        : `Ziehung ${seq} (Zahl ${number}) rückgängig gemacht`,
    claimRejected: (prize: string, missing: string): string =>
      `Fehlmeldung, ${prize}: es fehlen ${missing}`,
    lateRejected: (prize: string, seq: number): string =>
      `Verspätete Meldung abgelehnt, ${prize}: gültig seit Ziehung ${seq}`,
    awarded: (prize: string, cards: string): string => `Gewinn bestätigt, ${prize}: ${cards}`,
    awardedTiebreak: (prize: string, cards: string): string =>
      `Gewinn nach Stechen bestätigt, ${prize}: ${cards}`,
    revoked: (prize: string, reason: string, cards: string | undefined): string =>
      cards === undefined
        ? `Gewinn widerrufen, ${prize}: ${reason}`
        : `Gewinn widerrufen, ${prize} (${cards}): ${reason}`,
    skipped: (prize: string, reason: string): string => `Preis übersprungen, ${prize}: ${reason}`,
    aborted: (round: number, reason: string): string => `Gang ${round} abgebrochen: ${reason}`,
    corrected: (prize: string, cards: string, reason: string): string =>
      reason === ''
        ? `Gewinnkarte korrigiert, ${prize}: ${cards}`
        : `Gewinnkarte korrigiert, ${prize}: ${cards} (${reason})`,
    handout: (prize: string, collected: boolean): string =>
      collected ? `Preis abgeholt, ${prize}` : `Abholung zurückgesetzt, ${prize}`,
    completed: 'Anlass abgeschlossen',
    settings: (changes: string): string => `Einstellungen geändert: ${changes}`,
    settingChange: (field: string, from: string, to: string): string =>
      `${field} von «${from}» auf «${to}»`,
    prizes: (action: string, rounds: string): string =>
      rounds === '' ? `Preise geändert: ${action}` : `Preise geändert: ${action} (Gänge ${rounds})`,
    pinReset: 'PIN zurückgesetzt',
    personalDataErased: (count: number): string =>
      count === 1 ? 'Namen gelöscht (1 Gewinnkarte)' : `Namen gelöscht (${count} Gewinnkarten)`,
    controlTakenOver: 'Steuerung von einem anderen Fenster übernommen',
  },
  verify: {
    button: 'Protokoll prüfen',
    running: 'Prüft …',
    hint: 'Prüft die SHA-256-Verkettung der gespeicherten Einträge. Namen sind ausgenommen, damit sie gelöscht werden können.',
    ok: (count: number): string => `${count} Einträge geprüft: Die Kette ist unversehrt.`,
    broken: (seq: number): string => `Die Kette ist ab Eintrag ${seq} beschädigt oder verändert.`,
    failed: 'Die Prüfung ist fehlgeschlagen. Bitte erneut versuchen.',
  },
};

export type AuditMessages = typeof audit;
