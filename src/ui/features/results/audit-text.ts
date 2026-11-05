import type { AuditEntry } from '../../../application/audit';
import type { PrizeSlot, Winner } from '../../../domain/types';
import type { AuditMessages } from '../../../i18n/de-CH/audit';
import type { CommonMessages } from '../../../i18n/de-CH/common';

function prize(round: number, slot: PrizeSlot, m: AuditMessages, c: CommonMessages): string {
  return m.prize(round, c.prizeSlot(slot));
}

/** "Karte 17, Karte 30" or "ohne Kartennummer". */
export function cardsText(winners: readonly Winner[], m: AuditMessages): string {
  return winners
    .map((winner) => (winner.cardNo === undefined ? m.noCard : m.card(winner.cardNo)))
    .join(', ');
}

/** One readable sentence per log entry (no personal data beyond card numbers). */
export function describeAudit(entry: AuditEntry, m: AuditMessages, c: CommonMessages): string {
  const { event } = entry;
  const e = m.events;
  switch (event.type) {
    case 'ROUND_STARTED':
      return event.reason === undefined
        ? e.roundStarted(event.round, event.rules.maxNumber)
        : e.roundJumped(event.round, event.reason);
    case 'NUMBER_DRAWN':
      return e.numberDrawn(event.draw.number, event.draw.seq, event.draw.method === 'MANUAL');
    case 'DRAW_UNDONE':
      return e.drawUndone(event.seq, entry.undoneNumber);
    case 'CLAIM_REJECTED':
      return event.lateSinceSeq === undefined
        ? e.claimRejected(prize(event.round, event.slot, m, c), event.missing.join(', '))
        : e.lateRejected(prize(event.round, event.slot, m, c), event.lateSinceSeq);
    case 'PRIZE_AWARDED':
      return event.tiebreak === undefined
        ? e.awarded(prize(event.round, event.slot, m, c), cardsText(event.winners, m))
        : e.awardedTiebreak(prize(event.round, event.slot, m, c), cardsText(event.winners, m));
    case 'AWARD_REVOKED':
      return e.revoked(
        prize(event.round, event.slot, m, c),
        event.reason,
        entry.revokedWinners === undefined ? undefined : cardsText(entry.revokedWinners, m),
      );
    case 'PRIZE_SKIPPED':
      return e.skipped(prize(event.round, event.slot, m, c), event.reason);
    case 'ROUND_ABORTED':
      return e.aborted(event.round, event.reason);
    case 'WINNER_CORRECTED':
      return e.corrected(
        prize(event.round, event.slot, m, c),
        cardsText(event.winners, m),
        event.reason,
      );
    case 'HANDOUT_CHANGED':
      return e.handout(prize(event.round, event.slot, m, c), event.status === 'COLLECTED');
    case 'EVENT_COMPLETED':
      return e.completed;
    case 'SETTINGS_CHANGED':
      return e.settings(
        event.changes
          .map((change) => e.settingChange(change.field, change.from, change.to))
          .join('; '),
      );
    case 'PRIZES_CHANGED':
      return e.prizes(event.action, event.rounds.join(', '));
    case 'PIN_RESET':
      return e.pinReset;
    case 'PERSONAL_DATA_ERASED':
      return e.personalDataErased(event.winners);
    case 'CONTROL_TAKEN_OVER':
      return e.controlTakenOver;
  }
}
