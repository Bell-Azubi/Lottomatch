# ADR-0027: The Superlotto is an optional fifth prize

- Status: Accepted
- Date: 2026-11-06

## Context

The prize list of the event is an Excel sheet with four prizes per round, called 1. Preis to 4. Preis
and played in that order. Selected rounds add a Superlotto. The app knew exactly four prizes per
round and treated the fourth as the Hauptpreis, in red, with large confetti and for a full card. With
this list, a Zopf would have appeared as the Hauptpreis.

The organiser's rules: the four prizes need one row, the Superlotto needs a full card. After the
fourth prize the board is not cleared, and play goes on until someone has a full card.

Stored logs, prize catalogues and backups must keep loading, and they have no migration.

## Decision

- A slot 5 joins the four slots. `PRIZE_SLOTS` stays the four prizes of every round, and the win
  condition template keeps exactly those four entries, all 1 Reihe by default. The Superlotto defaults
  to Volle Karte, and its form can change that.
- A round has a Superlotto when the catalogue holds a prize at slot 5. That prize comes from the
  prize list, built in (ADR-0028) or imported. The Preise tab shows the form for it only in those
  rounds and offers no way to add one, because a round without a Superlotto in the list must not have
  a setting for it.
- A Superlotto row without a title still gives the round its Superlotto, titled Superlotto until the
  prize is entered in its form. The list can name the round before the prize is known.
- The fact is frozen when the round starts, as the optional `superlotto: true` in the rules of
  `ROUND_STARTED` (invariant I6). A log without the field means four prizes, so older logs replay
  unchanged. Slot-dependent state rules ask `slotsOfRound`.
- Once a round has started without a Superlotto, slot 5 of that round is locked until an abort, so a
  CSV row for it is refused. A catalogue change could otherwise alter a running round, which replay
  could not reproduce.
- The Superlotto is played after the fourth prize and never clears the board. With the setting that
  clears the board after each prize, it goes on with the numbers of the fourth prize (`poolDraws`).
- The word Hauptpreis is gone from the program, and every name in the code says Superlotto. The fourth
  prize is called Preis 4, and red and large confetti mark the Superlotto only.
- CSV: the import accepts `1. Preis` to `4. Preis` and `Superlotto`, and the export writes these names.
  A row with `Hauptpreis` is reported as an error. It must not silently become Preis 4 or the
  Superlotto, since an older file meant the fourth prize by it.
- Copying a round moves the four prizes and leaves the Superlotto of the target alone, so a copy never
  changes which rounds play one. Applying the template leaves its rule alone. Clearing a round removes
  it.

## Consequences

- A Superlotto that is missing from the catalogue is not a gap, because most rounds have none. If it
  is removed from a running round that has one, the round still plays it and shows the slot name.
- The import adds and overwrites, it never removes. A Superlotto struck from the list after an import
  is removed with Preis entfernen in that round.
- Beyond the built-in list, only a CSV import brings a Superlotto into an event.
- Stored events keep their template, so one created earlier may still have Volle Karte for Preis 4
  until it is changed in Einstellungen.
- Logs written by this version cannot be read by older builds, because slot 5 and the new rules field
  are unknown there. Schema version 1 stays, since older data needs no change.
- The disc of the fourth prize now shows 4 instead of H, so the display reference images need to be
  generated again.
