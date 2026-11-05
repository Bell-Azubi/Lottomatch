# Implementation plan

Lottomatch Live is built in the six phases of the brief (§13). Every phase ends with the
quality gates green: lint (ESLint `strictTypeChecked`, Prettier, knip), typecheck, unit and
component tests with coverage thresholds, production build with budgets, E2E with axe.

## Architecture in one paragraph

A static Preact + signals single-page app served from GitHub Pages. The game is
event-sourced: commands in `src/domain` validate invariants and return
`Result<LogEvent[], DomainError>`; a pure reducer folds the per-event log into `GameState`.
The application layer owns the signal store and the commit pipeline (validate → append in
memory → signals → ordered IndexedDB write queue → broadcast snapshot) and talks to the
browser only through injected ports (`RandomSource`, `EventStore`, `SyncTransport`, `Clock`,
`Announcer`, `WakeLock`). Infrastructure implements the ports; the UI renders signals.
The audience display is a second window of the same origin, synced by BroadcastChannel
snapshots ordered by `(epoch, seq)`, with a `storage`-event fallback.

## Phases and deliverables

| Phase           | Deliverables                                                                                                                                                                                                                 | Gate                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1 Foundation    | Pinned toolchain, strict TS, Vite (base from env, CSP meta, `404.html`, font preload), ESLint layer rules, CI/deploy/CodeQL workflows, Dependabot, tokens, app shell, hash router, trimmed logo, derived icons, subset fonts | build + lint + typecheck                     |
| 2 Domain engine | Types, commands, reducer, pool derivation, claim check with late detection, Stechen, RNG mapping with rejection sampling, CHF parsing, settings/prize validation, event store with write queue and hash chain, migrations    | domain coverage ≥ 95 %, property tests I1–I7 |
| 3 Live          | Host console, board, Drehen with reveal, manual entry and keypad, undo, claim dialog, Stechen, display window, sync, Web Locks takeover, wake lock, keyboard                                                                 | component tests, E2E live flows              |
| 4 Content       | Prize manager, CSV and JSON import/export, prepared event files, image pipeline, print list, settings, events and practice mode, PIN, about and diagnostics                                                                  | component tests, E2E import                  |
| 5 Experience    | Start page with readiness checklist, results and audit viewer, overlays, confetti, PWA update prompt, offline, voice and sound                                                                                               | E2E offline, overlays, axe                   |
| 6 Hardening     | Budgets, Lighthouse CI, visual snapshots, docs, test report, v1.0.0                                                                                                                                                          | all gates                                    |

## Key decisions (details in `docs/adr/`)

- Preact 10.29 instead of the one-month-old 11.x (ADR-0002); TypeScript 6.0 because
  typescript-eslint supports `< 6.1` (ADR-0003).
- Domain event schema extends the brief with rule snapshots, prize snapshots and audit-only
  events (ADR-0004); personal fields are redactable and excluded from the hash chain (ADR-0005).
- Stechen draws with replacement so ties can occur and are re-drawn (ADR-0006).
- Rounds can be aborted, resumed and jumped to; event completion is an explicit host action
  (ADR-0008).
- Sync uses `(epoch, seq)` ordering and a flush-before-takeover handshake (ADR-0010).
