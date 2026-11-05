/** de-CH copy for Gewinn prüfen, Fehlmeldung, Stechen and Gewinn bestätigen (FR-6, FR-7). */
export const claim = {
  title: 'Gewinn prüfen',
  drawLocked: 'Ziehen ist gesperrt, solange dieser Dialog offen ist.',
  expected: (count: number): string => `${count} Zahlen erwartet`,
  free: 'Eigene Regel: beliebig viele Zahlen',
  numberLabel: 'Zahl auf der Karte',
  add: 'Hinzufügen',
  chipsLabel: 'Gemeldete Zahlen',
  chipDrawn: (n: number): string => `${n}, gezogen`,
  chipMissing: (n: number): string => `${n}, fehlt`,
  removeChip: (n: number): string => `${n} entfernen`,
  duplicate: (n: number): string => `${n} ist schon erfasst.`,
  outOfRange: (max: number): string => `Nur Zahlen von 1 bis ${max}.`,
  notANumber: 'Nur Ziffern 0–9 erlaubt.',
  count: (have: number, expected: number | undefined): string =>
    expected === undefined ? `${have} Zahlen erfasst` : `${have} von ${expected} Zahlen erfasst`,
  valid: 'Gültig',
  validSince: (seq: number, n: number, current: number): string =>
    `gültig seit Ziehung ${seq} (Zahl ${n}), aktuell Ziehung ${current}`,
  late: 'Verspätete Meldung',
  lateAllow: 'Zulassen',
  lateReject: 'Ablehnen',
  latePolicyRejects: 'Verspätete Meldungen werden abgelehnt (Einstellung).',
  invalid: 'Fehlmeldung',
  missingList: (list: string): string => `Fehlende Zahlen: ${list}`,
  wrongCount: (have: number, expected: number): string =>
    `Erst ${have} von ${expected} Zahlen erfasst.`,
  recordFalse: 'Fehlmeldung erfassen',
  claimants: 'Karten',
  claimant: (index: number): string => `Karte ${index}`,
  addClaimant: 'Weitere Karte prüfen',
  removeClaimant: 'Karte entfernen',
  cardNo: 'Kartennummer (optional)',
  name: 'Name (optional)',
  note: 'Notiz (optional)',
  privacy: 'Namen bleiben auf diesem Gerät und lassen sich jederzeit löschen.',
  cardWonEarlier: (card: string): string => `Karte ${card} hat in dieser Runde bereits gewonnen.`,
  validCount: (count: number): string =>
    count === 1 ? '1 gültige Karte' : `${count} gültige Karten`,
  share: 'Preis teilen',
  shareHint: 'Einstellung «Teilen»: Alle gültigen Karten gewinnen gemeinsam.',
  tiebreak: {
    title: 'Stechen',
    hint: (highest: boolean): string =>
      highest ? 'Höchste Zahl gewinnt.' : 'Tiefste Zahl gewinnt.',
    run: 'Stechen ziehen',
    again: 'Gleichstand – nochmals ziehen',
    pass: (pass: number): string => `Durchgang ${pass}`,
    winner: (label: string): string => `${label} gewinnt das Stechen`,
  },
  confirm: 'Gewinn bestätigen',
  confirmed: 'Gewinn bestätigt',
  confirmWithoutCheck: 'Ohne Prüfung bestätigen',
  backToCheck: 'Zurück zur Prüfung',
  detailsTitle: 'Gewinnkarte',
};

export type ClaimMessages = typeof claim;
