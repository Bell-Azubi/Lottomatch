# ADR-0001: Record architecture decisions

- Status: Accepted
- Date: 2026-11-05

## Context

The brief asks for autonomous decisions wherever it is ambiguous, each recorded so that the club
committee and future maintainers can see why the app behaves as it does. Decisions also explain
deviations from the technology list in §4 of the brief.

## Decision

Every decision that shapes behaviour, data formats or the toolchain is recorded as a short ADR in
`docs/adr/`, numbered sequentially (`NNNN-title.md`), with the sections Context, Decision,
Consequences and a status. ADRs are written in English; user-facing guides are in German.
Superseded ADRs are kept and marked `Superseded by ADR-NNNN`.

## Consequences

- Code comments, `docs/assumptions.md` and `docs/plan.md` reference ADRs by number.
- A pull request that changes a recorded decision adds or supersedes an ADR (see the PR template).
