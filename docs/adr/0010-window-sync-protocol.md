# ADR-0010: Window sync protocol and single controlling window

- Status: Accepted
- Date: 2026-11-05

## Context

FR-10 requires a display window synced live with the host console, ordered snapshots, a display
that also works without a host, exactly one controlling window and a takeover ("Steuerung
übernehmen"). Several host windows of one browser share one IndexedDB.

## Decision

- Transport: BroadcastChannel `lottomatch-live`; fallback `storage` events on one localStorage key
  with a nonce. Every received message is validated with Valibot and dropped if malformed.
- Messages: `snapshot`, `hello` (a display asks for the current snapshot), `display-alive`
  (heartbeat every 2 s with the last seen position), `persisted` (a log append is durable),
  `takeover-request`, `takeover-ready`, `reload` (after an update).
- Ordering: snapshots are ordered by `(epoch, seq)`. The epoch is stored in IndexedDB and
  incremented whenever a window gains control; `seq` increases with every publication. A display
  renders only snapshots newer than the one shown. With no host it renders the persisted state at
  epoch 0.
- Control: the Web Locks API lock `lottomatch-live-host` (`ifAvailable`) decides the controlling
  window; other host windows open read-only and reload on `persisted`. A takeover sends
  `takeover-request`; the controller flushes its write queue, releases the lock and answers
  `takeover-ready`; the requester then steals the lock (after the answer or 2 s), starts a new
  epoch, reloads from storage and logs `CONTROL_TAKEN_OVER`.
- Split brain: log entries are written with `add` on the key `[matchId, seq]`, so a second writer
  fails with `ConstraintError`; the write queue then stops writing and asks for a reload.
- The host shows "Anzeige verbunden" while a heartbeat is younger than 5 s and synchronised when
  its position equals the latest snapshot.

## Consequences

- The display never waits for storage: the snapshot is published right after the in-memory
  commit, the durable write follows in the queue.
- `SyncTransport` is the seam for a future realtime backend without touching the domain.
