/** de-CH copy for the audience display. Ring lettering is uppercase, as on the badge. */
export const display = {
  title: 'Anzeige',
  waiting: 'Gleich geht’s los',
  latest: 'Zuletzt gezogen',
  latestNumber: (n: number, seq: number): string => `Zuletzt gezogen: ${n}, Ziehung ${seq}`,
  ringTop: (round: number, total: number): string => `RUNDE ${round} VON ${total}`,
  ringBottom: (seq: number): string => `ZIEHUNG ${seq}`,
  ringSuperlotto: 'SUPERLOTTO',
  ringPractice: 'ÜBUNG',
  fullscreenHint: 'Klicken oder F drücken für Vollbild',
  welcome: {
    greeting: 'Herzlich willkommen',
    event: 'zum Lottomatch der',
    club: 'FC Laufenburg-Kaisten Senioren',
    luck: 'Viel Glück!',
    ringTop: 'HERZLICH WILLKOMMEN',
    ringBottom: 'FC LAUFENBURG-KAISTEN SENIOREN',
    mark: ['LOTTO', 'MATCH'],
  },
  win: {
    title: 'Gewinn!',
    superlottoTitle: 'Superlotto!',
    card: (cardNo: string): string => `Karte ${cardNo}`,
  },
  roundEnd: {
    title: (round: number): string => `Runde ${round} ist fertig`,
    next: (round: number): string => `Runde ${round}: diese Preise warten`,
    allPlayed: 'Alle Runden sind gespielt',
  },
  pause: {
    resume: (time: string): string => `Weiter um ${time} Uhr`,
    sponsors: 'Herzlichen Dank an',
  },
  gameEnd: {
    title: 'Danke fürs Mitspielen!',
  },
};

export type DisplayMessages = typeof display;
