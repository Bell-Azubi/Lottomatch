# ADR-0004: Extensions of the domain event schema

- Status: Accepted
- Date: 2026-11-05

## Context

§6 of the brief sketches the `DomainEvent` union. Building the commands, the replay validation
and the results page showed that some facts must be recorded at the moment they happen, or the
log could not be verified or replayed on its own.

## Decision

The log (`src/domain/types.ts`) keeps every event of the brief and extends it:

- `ROUND_STARTED` carries `rules` (maximum number, numbers per line, lines, board-reset mode)
  frozen for the run (invariant I6), and an optional `reason` when the host jumped to the round.
- `PRIZE_AWARDED` carries a `prize` snapshot (title, win condition, value, sponsor) so results
  stay verifiable when the catalogue changes later. Each `Winner` has its own optional
  `validSinceSeq`; with a Stechen the event also holds `claimants` and `tiebreak` draws with a
  `pass` number, where `claimant` indexes `claimants`.
- `CLAIM_REJECTED` records the `claimed` numbers and, for rejected late claims, `lateSinceSeq`.
- New game events: `WINNER_CORRECTED` (winner details of an earlier award, never who won) and
  `HANDOUT_CHANGED` (Gabentisch status `OPEN`/`COLLECTED`).
- Audit-only events that never change the game state: `SETTINGS_CHANGED`, `PRIZES_CHANGED`,
  `PIN_RESET`, `PERSONAL_DATA_ERASED`, `CONTROL_TAKEN_OVER`.
- The persisted envelope nests the event under `event` next to `id`, `matchId`, `seq`, `at`,
  `schemaVersion`, `prevHash` and `hash` instead of spreading it, which keeps the TypeScript union
  and the Valibot schema discriminated on `event.type`.

## Consequences

- `replay` rebuilds the state from the log alone and validates every event with the same
  `checkEvent` the commands use; a corrupt log opens the recovery screen.
- Changing settings or prizes after the first round writes an audit entry instead of mutating
  history.
