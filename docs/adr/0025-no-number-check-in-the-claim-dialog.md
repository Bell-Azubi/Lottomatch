# ADR-0025: No number check in the claim dialog

- Status: Accepted
- Date: 2026-11-06

## Context

Gewinn prüfen had two steps: typing the numbers of the claimed card one by one, then Gewinn
bestätigen. The club checks a claimed card at the table anyway (die Kontrolle), so typing the same
numbers again on the console is unnecessary work during the event. Only the confirmation matters:
it records the winner and moves on to the next prize.

## Decision

- Gewinn prüfen (button or G) opens Gewinn bestätigen directly: card number, name and note, all
  optional. Nothing is awarded until the host confirms.
- Several cards remain possible with "Weitere Karte": they go to Stechen or Teilen as before. A card
  added by mistake can be removed until the Stechen has started.
- The number check, Fehlmeldung and the detection of late claims are removed from the app, with
  `domain/claim.ts`.
- The settings "Verspätete Meldungen" and the card layout (numbers per line, lines) had no other
  effect and are no longer offered.

The data format does not change (schema version 1):

- `MatchSettings` and `RoundRules` keep `lateClaimPolicy`, `perLine` and `lines`, so stored events
  and backups stay valid. New events hold the defaults.
- `CLAIM_REJECTED`, `lateSinceSeq` and `Winner.validSinceSeq` stay in the log schema, in `checkEvent`
  and in the results, so events played before this decision still load, verify and show their false
  claims and late claims. The domain command `rejectClaim` stays for the invariant tests of such logs.

## Consequences

- A win takes fewer steps at the console.
- The app no longer checks a claimed card against the drawn numbers. A wrong confirmation is
  corrected with "Letzten Gewinn widerrufen", as before.
- False claims and late claims of new events are not recorded. The Auswertung lists false claims only
  for events that hold them. The column for late claims in the winner CSV stays, so the file format is
  unchanged.
- The win conditions (1 Reihe, 2 Reihen, Volle Karte, Eigene Regel) are now labels for the hall.
