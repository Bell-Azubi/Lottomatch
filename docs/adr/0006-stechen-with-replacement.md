# ADR-0006: Stechen draws with replacement

- Status: Accepted
- Date: 2026-11-05

## Context

FR-7: a Stechen draws one number per claimant from a pool separate from the board; the highest
(or lowest) number wins and "remaining ties re-draw among the tied claimants only". Drawing
without replacement from 1–N could never produce a tie, so the tie rule would be dead.

## Decision

Each pass draws, for every claimant still in contention, an independent uniform number in 1–N
(`uniformNumber` with rejection sampling, never `Math.random`). The best number wins; if several
claimants share it, only they draw again in the next pass. Every draw is stored with its pass in
`PRIZE_AWARDED.tiebreak`. The board and its pool are untouched.

## Consequences

- Ties are possible and handled visibly ("Gleichstand – nochmals ziehen").
- The order (highest or lowest wins) is an event setting; the default is highest.
- With the policy "Teilen", no Stechen runs and all valid claimants win together.
