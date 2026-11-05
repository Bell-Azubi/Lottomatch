/** de-CH copy for the start page and the event-readiness checklist (FR-11). */
export const start = {
  title: 'Start',
  activeEvent: 'Aktiver Anlass',
  noEvent: 'Noch kein Anlass vorhanden.',
  createEvent: 'Anlass erstellen',
  status: {
    READY: 'Bereit, noch keine Runde gespielt',
    ROUND_RUNNING: (round: number): string => `Runde ${round} läuft`,
    BETWEEN_ROUNDS: (played: number, total: number): string =>
      `${played} von ${total} Runden gespielt`,
    COMPLETED: 'Abgeschlossen',
  },
  startRound: 'Runde starten',
  resume: 'Weiterspielen',
  toResults: 'Zur Auswertung',
  practiceHint: 'Übung: getrennt vom echten Anlass, ohne Auswirkung auf dessen Daten.',
  switchEvent: 'Anlass wechseln',
  readiness: {
    title: 'Bereit für den Anlass?',
    prizes: 'Preise vollständig',
    prizesMissing: (count: number): string =>
      count === 1 ? '1 Preis fehlt' : `${count} Preise fehlen`,
    display: 'Anzeige geöffnet und synchron',
    displayMissing: 'Anzeige noch nicht geöffnet',
    offline: 'Offline bereit',
    offlineMissing: 'Offline-Speicher wird vorbereitet (Seite einmal neu laden)',
    offlineUnsupported: 'Dieser Browser unterstützt keinen Offline-Betrieb',
    backup: 'Sicherung exportiert',
    backupMissing: 'Noch keine Sicherung exportiert',
    backupAt: (when: string): string => `Sicherung vom ${when}`,
    wakeLock: 'Bildschirm bleibt an',
    wakeLockMissing: 'Bildschirm-Sperre nicht verfügbar: Energiesparen im System ausschalten',
    storage: 'Dauerhafter Speicher',
    storageMissing: 'Speicher nicht dauerhaft: vor und nach dem Anlass sichern',
    done: 'erledigt',
    open: 'offen',
    fix: 'Beheben',
  },
  gapsConfirm: {
    title: 'Preise fehlen',
    body: 'Diese Runden haben Lücken. Die Anzeige zeigt dort «Preis n» und die Gewinnregel.',
    round: (round: number, slots: string): string => `Runde ${round}: ${slots}`,
    confirm: 'Trotzdem starten',
  },
};

export type StartMessages = typeof start;
