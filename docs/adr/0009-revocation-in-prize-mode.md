# ADR-0009: Revocation in per-prize board mode requires no later draws

- Status: Accepted
- Date: 2026-11-05

## Context

FR-4 allows revoking the latest award of the current round; its prize becomes active again. With
"Brett nach jedem Preis leeren" every prize has its own pool and the caller refills the physical
drum after each award. If draws for the next prize already happened, the drum no longer reflects
the reactivated prize's pool.

## Decision

In per-prize mode (`boardReset: 'PRIZE'`) a revocation is refused with
`REVOKE_BLOCKED_BY_DRAWS` while any draw of the round is newer than the award. The caller first
undoes those draws (allowed, because no award follows them), then revokes. In round mode the pool
is continuous and revocation is allowed after later draws.

## Consequences

- The app never shows a pool that differs from the physical drum.
- The error message tells the caller exactly what to do.
