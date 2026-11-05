# ADR-0008: Round lifecycle, overrides and event completion

- Status: Accepted
- Date: 2026-11-05

## Context

FR-5 names three host overrides (skip prize, abort round, jump to round) but leaves open what an
aborted round means afterwards, which round "Runde starten" picks after a jump, and when the event
counts as finished.

## Decision

- Round states: `UPCOMING`, `RUNNING`, `COMPLETED` (all four prizes awarded or skipped) and
  `ABORTED`.
- Aborting keeps every award; unresolved prizes stay open. A round aborted before any draw or
  award returns to `UPCOMING` (an accidental start leaves no trace except the audit entry).
- An aborted round is resumed only through "Zu Runde springen" with a reason: the board restarts
  empty and the first open prize becomes active. Jumping while a round runs aborts it with the
  same reason. Completed rounds cannot be jumped to.
- "Runde starten" begins the lowest upcoming round from the current round on, else the lowest
  upcoming round overall. Jumped-over rounds therefore stay playable.
- Revoking the latest award of a completed current round reopens it with that prize active.
- The event is completed only by the explicit host action "Anlass abschliessen", allowed when no
  round runs. Afterwards only winner corrections and handout changes are possible.

## Consequences

- Mistakes at the start of a round and in the last award stay recoverable.
- Results list aborted rounds and their open prizes as not awarded.
