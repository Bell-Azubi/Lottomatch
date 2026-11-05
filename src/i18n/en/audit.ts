import type { AuditMessages } from '../de-CH/audit';

export const audit: AuditMessages = {
  title: 'Audit log',
  intro: 'Every draw, win and intervention is recorded here; nothing is ever deleted.',
  category: 'Category',
  round: 'Round',
  allCategories: 'All categories',
  allRounds: 'All rounds',
  roundOption: (round) => `Round ${round}`,
  categories: {
    DRAWS: 'Draws',
    CLAIMS: 'Wins and false claims',
    CORRECTIONS: 'Corrections and revocations',
    OVERRIDES: 'Game-control interventions',
    DOCUMENTS: 'Settings and prizes',
    SYSTEM: 'System',
  },
  count: (shown, total) => `${shown} of ${total} entries`,
  more: 'Show more entries',
  empty: 'No entries for this selection.',
  entry: (seq) => `No. ${seq}`,
  prize: (round, slot) => `round ${round}, ${slot}`,
  card: (cardNo) => `card ${cardNo}`,
  noCard: 'no card number',
  events: {
    roundStarted: (round, max) => `Round ${round} started (numbers 1–${max})`,
    roundJumped: (round, reason) => `Jumped to round ${round}: ${reason}`,
    numberDrawn: (number, seq, manual) =>
      manual ? `${number} entered (draw ${seq})` : `${number} drawn (draw ${seq})`,
    drawUndone: (seq, number) =>
      number === undefined ? `Draw ${seq} undone` : `Draw ${seq} (number ${number}) undone`,
    claimRejected: (prize, missing) => `False claim, ${prize}: missing ${missing}`,
    lateRejected: (prize, seq) => `Late claim rejected, ${prize}: valid since draw ${seq}`,
    awarded: (prize, cards) => `Win confirmed, ${prize}: ${cards}`,
    awardedTiebreak: (prize, cards) => `Win confirmed after tie-break, ${prize}: ${cards}`,
    revoked: (prize, reason, cards) =>
      cards === undefined
        ? `Win revoked, ${prize}: ${reason}`
        : `Win revoked, ${prize} (${cards}): ${reason}`,
    skipped: (prize, reason) => `Prize skipped, ${prize}: ${reason}`,
    aborted: (round, reason) => `Round ${round} aborted: ${reason}`,
    corrected: (prize, cards, reason) =>
      reason === ''
        ? `Winning card corrected, ${prize}: ${cards}`
        : `Winning card corrected, ${prize}: ${cards} (${reason})`,
    handout: (prize, collected) =>
      collected ? `Prize collected, ${prize}` : `Collection reset, ${prize}`,
    completed: 'Event closed',
    settings: (changes) => `Settings changed: ${changes}`,
    settingChange: (field, from, to) => `${field} from «${from}» to «${to}»`,
    prizes: (action, rounds) =>
      rounds === '' ? `Prizes changed: ${action}` : `Prizes changed: ${action} (rounds ${rounds})`,
    pinReset: 'PIN reset',
    personalDataErased: (count) =>
      count === 1 ? 'Names deleted (1 winning card)' : `Names deleted (${count} winning cards)`,
    controlTakenOver: 'Control taken over from another window',
  },
  verify: {
    button: 'Verify log',
    running: 'Verifying …',
    hint: 'Checks the SHA-256 chain of the stored entries. Names are excluded so that they can be deleted.',
    ok: (count) => `${count} entries checked: the chain is intact.`,
    broken: (seq) => `The chain is damaged or altered from entry ${seq}.`,
    failed: 'Verification failed. Please try again.',
  },
};
