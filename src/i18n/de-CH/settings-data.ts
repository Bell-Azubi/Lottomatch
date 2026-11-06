/** de-CH copy for Einstellungen → Daten, PIN and Über (FR-9). */
export const settingsData = {
  data: {
    intro:
      'Alle Daten bleiben auf diesem Gerät. Vor und nach dem Anlass eine Sicherung exportieren.',
    export: 'Sicherung exportieren',
    exportHint: 'JSON mit Einstellungen, Preisen, Bildern, Spielprotokoll und SHA-256-Prüfsumme.',
    exported: 'Sicherung exportiert',
    lastBackup: (when: string): string => `Letzte Sicherung: ${when}`,
    noBackup: 'Noch keine Sicherung exportiert.',
    import: 'Sicherung oder Anlassdatei importieren',
    importHint: 'Wird als neuer Anlass angelegt; nichts Bestehendes wird überschrieben.',
    chooseFile: 'Datei wählen',
    reading: 'Datei wird geprüft …',
    previewTitle: 'Import prüfen',
    previewName: 'Anlass',
    previewDate: 'Datum',
    previewKind: 'Art',
    previewKinds: { REAL: 'Anlass', PRACTICE: 'Übung' },
    previewRounds: 'Gänge',
    previewPrizes: 'Preise',
    previewImages: 'Bilder',
    previewLog: 'Einträge im Spielprotokoll',
    previewAwards: 'Vergebene Preise',
    previewChecksum: 'Prüfsumme',
    checksumVerified: 'geprüft und korrekt',
    checksumAbsent: 'keine (z. B. vorbereitete Anlassdatei)',
    migrated: (version: number): string => `Aus Schemaversion ${version} übernommen.`,
    importConfirm: 'Als neuen Anlass importieren',
    imported: (name: string): string => `«${name}» importiert und aktiv`,
    importFailed: 'Der Import konnte nicht abgeschlossen werden.',
    importErrors: {
      NOT_JSON: 'Die Datei ist kein gültiges JSON.',
      FOREIGN: 'Die Datei stammt nicht aus Lottomatch Live.',
      TOO_NEW: (version: number): string =>
        `Die Datei stammt aus einer neueren Version (Schema ${version}). Bitte die App aktualisieren.`,
      UNSUPPORTED: (version: number): string => `Schemaversion ${version} wird nicht unterstützt.`,
      CHECKSUM_MISMATCH:
        'Die Prüfsumme stimmt nicht: Die Datei wurde verändert oder ist beschädigt.',
      INVALID: (path: string): string =>
        `Die Datei ist unvollständig oder fehlerhaft (bei «${path}»).`,
      INVALID_SETTINGS: 'Die Einstellungen in der Datei sind ungültig.',
      INVALID_PRIZES: (count: number): string =>
        count === 1
          ? '1 Preis in der Datei ist ungültig.'
          : `${count} Preise in der Datei sind ungültig.`,
      LOG_CORRUPT: (seq: number): string => `Das Spielprotokoll ist beschädigt (Eintrag ${seq}).`,
    },
    eraseNames: 'Alle Gewinnernamen löschen',
    eraseHint: 'Löscht Namen und Notizen aller Gewinner auf diesem Gerät. Kartennummern bleiben.',
    eraseTitle: 'Alle Gewinnernamen löschen?',
    eraseBody:
      'Namen und Notizen werden in allen Anlässen auf diesem Gerät entfernt. Das lässt sich nicht rückgängig machen; der Vorgang wird protokolliert.',
    eraseConfirm: 'Namen löschen',
    erased: (count: number): string =>
      count === 1 ? '1 Gewinnereintrag bereinigt' : `${count} Gewinnereinträge bereinigt`,
    reset: 'Anlass zurücksetzen',
    resetHint:
      'Löscht alle Ziehungen und Gewinne des aktiven Anlasses. Einstellungen und Preise bleiben.',
    resetTitle: 'Anlass zurücksetzen?',
    resetBody: 'Vorher eine Sicherung exportieren. Danach beginnt der Anlass wieder bei Gang 1.',
    resetWord: 'ZURÜCKSETZEN',
    resetPrompt: 'Zum Bestätigen «ZURÜCKSETZEN» eintippen',
    resetConfirm: 'Zurücksetzen',
    resetDone: 'Anlass zurückgesetzt',
  },
  pin: {
    intro:
      'Die PIN schützt Preise und Einstellungen vor versehentlichen Änderungen. Sie ist keine Sicherheitsgrenze: Wer das Gerät hat, kann sie zurücksetzen.',
    statusOn: 'Eine PIN ist gesetzt.',
    statusOff: 'Keine PIN gesetzt.',
    current: 'Aktuelle PIN',
    next: 'Neue PIN (4 bis 8 Ziffern)',
    confirm: 'Neue PIN wiederholen',
    set: 'PIN setzen',
    change: 'PIN ändern',
    remove: 'PIN entfernen',
    saved: 'PIN gespeichert',
    removed: 'PIN entfernt',
    invalid: 'Die PIN muss aus 4 bis 8 Ziffern bestehen.',
    mismatch: 'Die beiden Eingaben stimmen nicht überein.',
    wrong: 'Die aktuelle PIN ist falsch.',
    readOnly: 'Nur im steuernden Fenster möglich.',
  },
  about: {
    intro: 'Technische Angaben für Rückfragen. Die Diagnose enthält keine Namen.',
    version: 'Version',
    commit: 'Commit',
    buildDate: 'Build vom',
    storage: 'Speicher',
    storageUsage: (used: string, quota: string): string => `${used} von ${quota} belegt`,
    storageUnknown: 'Belegung unbekannt',
    persistence: 'Dauerhafter Speicher',
    persistenceStates: {
      PERSISTED: 'gewährt',
      BEST_EFFORT: 'nicht gewährt: Der Browser darf die Daten bei Speichermangel löschen',
      UNSUPPORTED: 'vom Browser nicht unterstützt',
    },
    backend: 'Speicherort',
    backends: {
      INDEXED_DB: 'IndexedDB auf diesem Gerät',
      MEMORY: 'Nur im Arbeitsspeicher: Daten gehen beim Schliessen verloren',
    },
    serviceWorker: 'Offline-Betrieb',
    serviceWorkerStates: {
      unsupported: 'vom Browser nicht unterstützt',
      failed: 'Registrierung fehlgeschlagen',
      update: 'Update bereit (wird zwischen den Gängen angeboten)',
      ready: 'bereit',
      pending: 'wird vorbereitet',
    },
    diagnostics: 'Diagnose exportieren',
    diagnosticsHint: 'JSON mit Version, Browser, Einstellungen und Fehlerprotokoll, ohne Namen.',
    diagnosticsDone: 'Diagnose exportiert',
    errors: (count: number): string =>
      count === 1 ? '1 Fehler protokolliert' : `${count} Fehler protokolliert`,
  },
};

export type SettingsDataMessages = typeof settingsData;
