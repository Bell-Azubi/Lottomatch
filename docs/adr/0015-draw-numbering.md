# ADR-0015: Draw numbering (Ziehung n) is per round

- Status: Accepted
- Date: 2026-11-05

## Context

The display letters "ZIEHUNG 37" on the badge and the claim check says "gültig seit Ziehung 37
(Zahl 42), aktuell Ziehung 39". The number must be meaningful to the caller and the hall, while
the log needs a unique, strictly increasing order (I7).

## Decision

- `Draw.seq` is the 1-based position of a draw within the current run of its round, counted across
  all prizes of the round (also in per-prize board mode).
- Undoing the latest draw frees its position; the next draw reuses it.
- Ordering and uniqueness come from the envelope's `seq` (per event, strictly increasing), never
  from `Draw.seq` or wall-clock time.

## Consequences

- "Ziehung n" always matches what the hall saw in this round.
- Audit entries identify a draw as round plus position plus log sequence.
