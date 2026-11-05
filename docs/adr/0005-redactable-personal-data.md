# ADR-0005: Personal data is redactable and excluded from the hash chain

- Status: Accepted
- Date: 2026-11-05

## Context

Two requirements collide. The audit log is append-only and nothing is ever deleted from it
(FR-4), optionally protected by a hash chain. The revFADP-inspired constraint C6 demands that
winner names can be deleted in one action and never leave the device.

## Decision

- `Winner.name` and `Winner.note` are the only personal fields (`REDACTABLE_WINNER_FIELDS`).
  Card numbers and claim references are not personal data.
- The SHA-256 hash of each envelope covers a canonical JSON form (sorted keys) that omits those
  two fields in `winners` and `claimants`: `hash = SHA-256(prevHash + "\n" + canonical(envelope))`.
- "Alle Gewinnernamen löschen" rewrites the stored `PRIZE_AWARDED` and `WINNER_CORRECTED` entries
  of every event on the device without those fields, then appends `PERSONAL_DATA_ERASED` with the
  number of winners changed. No entry is removed and the chain stays valid.

## Consequences

- Tamper evidence covers every game-relevant fact (draws, awards, card numbers, reasons) but not
  names; this is stated in the audit view.
- Exports contain names only until they are erased; prepared event files in the repository never
  contain any.
