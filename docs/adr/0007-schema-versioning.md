# ADR-0007: Schema version 1 and forward migrations

- Status: Accepted
- Date: 2026-11-05

## Context

The brief asks for schema versions with forward migrations and for imports of older versions.
Version 1.0.0 is the first release, so no older format exists yet. Inventing a fake predecessor
would add code that no real file ever exercises.

## Decision

- Stored envelopes and exported files carry `schemaVersion`; the current version is 1
  (`SCHEMA_VERSION`). IndexedDB itself is at database version 1.
- `src/application/migrations.ts` holds a registry of steps (`k → k + 1`) and a `migrate` function
  used for every stored envelope and every imported file. The registry ships empty; each future
  format adds exactly one step.
- Files from a newer version are refused with a clear message (`TOO_NEW`); versions below 1,
  missing steps or a step that does not advance the version are refused as unsupported.
- The pipeline is unit-tested with synthetic steps injected through the `registry` parameter.

## Consequences

- Corrupt, foreign and newer files never reach the domain; they are rejected before preview.
- A future v2 must add a migration step and a test with a real v1 fixture.
