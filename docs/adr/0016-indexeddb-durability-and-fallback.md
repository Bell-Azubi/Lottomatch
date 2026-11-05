# ADR-0016: IndexedDB with strict durability and a memory fallback

- Status: Accepted
- Date: 2026-11-05

## Context

The brief demands zero data loss after any committed action across reload, tab crash, browser
crash and power loss, and a clear warning when storage cannot survive the window (private mode,
missing IndexedDB, quota exceeded).

## Decision

- One database `lottomatch-live` (version 1) with the stores `matches`, `catalogues`, `log`
  (key `[matchId, seq]`), `images` and `meta`, accessed through `idb`.
- Log appends run in `readwrite` transactions with `durability: 'strict'` and `add` (never `put`).
- All writes pass one ordered queue; a failing job is retried with exponential backoff
  (1 s doubling to 30 s) while later jobs wait, the in-memory state stays authoritative and a
  persistent banner offers an immediate export.
- `navigator.storage.persist()` is requested and its result shown on the start page.
- If IndexedDB cannot be opened, in-memory stores with the same interfaces take over and a red
  banner warns that data will not survive the window.

## Consequences

- A committed action is on disk before the transaction completes; ordering is preserved even
  under retries.
- In memory-only mode the caller can still run the event and must export backups.
