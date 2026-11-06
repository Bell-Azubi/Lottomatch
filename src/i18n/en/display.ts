import type { DisplayMessages } from '../de-CH/display';

export const display: DisplayMessages = {
  title: 'Display',
  waiting: 'Starting soon',
  latest: 'Drawn last',
  latestNumber: (n, seq) => `Drawn last: ${n}, draw ${seq}`,
  ringTop: (round, total) => `ROUND ${round} OF ${total}`,
  ringBottom: (seq) => `DRAW ${seq}`,
  ringMain: 'MAIN PRIZE',
  ringPractice: 'PRACTICE',
  fullscreenHint: 'Click or press F for fullscreen',
  welcome: {
    greeting: 'Welcome',
    event: 'to the Lottomatch of the',
    club: 'FC Laufenburg-Kaisten seniors',
    luck: 'Good luck!',
    ringTop: 'WELCOME',
    ringBottom: 'FC LAUFENBURG-KAISTEN SENIORS',
    mark: ['LOTTO', 'MATCH'],
  },
  win: {
    title: 'Winner!',
    mainTitle: 'Main prize!',
    card: (cardNo) => `Card ${cardNo}`,
  },
  roundEnd: {
    title: (round) => `Round ${round} is finished`,
    next: (round) => `Round ${round}: these prizes are waiting`,
    allPlayed: 'All rounds have been played',
  },
  pause: {
    resume: (time) => `Resuming at ${time}`,
    sponsors: 'With many thanks to',
  },
  gameEnd: {
    title: 'Thank you for playing!',
  },
};
