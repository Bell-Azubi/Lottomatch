/** de-CH copy for Gewinn bestätigen and Stechen (FR-6, FR-7). */
export const claim = {
  drawLocked: 'Ziehen ist gesperrt, solange dieser Dialog offen ist.',
  claimants: 'Karten',
  claimant: (index: number): string => `Karte ${index}`,
  addClaimant: 'Weitere Karte',
  removeClaimant: 'Karte entfernen',
  cardNo: 'Kartennummer (optional)',
  name: 'Name (optional)',
  note: 'Notiz (optional)',
  privacy: 'Namen bleiben auf diesem Gerät und lassen sich jederzeit löschen.',
  cardWonEarlier: (card: string): string => `Karte ${card} hat in diesem Gang bereits gewonnen.`,
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
  detailsTitle: 'Gewinnkarte',
};

export type ClaimMessages = typeof claim;
