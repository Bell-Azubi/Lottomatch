import type { ClaimMessages } from '../de-CH/claim';

export const claim: ClaimMessages = {
  drawLocked: 'Drawing is locked while this dialog is open.',
  claimants: 'Cards',
  claimant: (index) => `Card ${index}`,
  addClaimant: 'Another card',
  removeClaimant: 'Remove card',
  cardNo: 'Card number (optional)',
  name: 'Name (optional)',
  note: 'Note (optional)',
  privacy: 'Names stay on this device and can be deleted at any time.',
  cardWonEarlier: (card) => `Card ${card} has already won in this round.`,
  validCount: (count) => (count === 1 ? '1 valid card' : `${count} valid cards`),
  share: 'Share prize',
  shareHint: 'Setting «Share»: all valid cards win together.',
  tiebreak: {
    title: 'Tie-break',
    hint: (highest) => (highest ? 'Highest number wins.' : 'Lowest number wins.'),
    run: 'Draw tie-break',
    again: 'Tie – draw again',
    pass: (pass) => `Pass ${pass}`,
    winner: (label) => `${label} wins the tie-break`,
  },
  confirm: 'Confirm win',
  confirmed: 'Win confirmed',
  detailsTitle: 'Winning card',
};
