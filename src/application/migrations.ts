import { err, ok, type Result } from '../domain/result';
import { SCHEMA_VERSION } from '../domain/types';

/** Migrates a document from version `k` to `k + 1`; must set `schemaVersion` to `k + 1`. */
export type MigrationStep = (input: Readonly<Record<string, unknown>>) => Record<string, unknown>;

export interface MigrationRegistry {
  readonly current: number;
  /** Step `k` migrates version `k` to `k + 1`. */
  readonly steps: ReadonlyMap<number, MigrationStep>;
}

export type MigrationError =
  | { readonly code: 'NOT_VERSIONED' }
  | { readonly code: 'TOO_NEW'; readonly version: number }
  | { readonly code: 'UNSUPPORTED'; readonly version: number };

/**
 * Forward migrations for exported files and stored envelopes. Schema version 1 is the first
 * released format, so the registry holds no steps yet; every later format adds one step.
 */
export const MIGRATIONS: MigrationRegistry = { current: SCHEMA_VERSION, steps: new Map() };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Runs forward migrations until the document reaches the current schema version. */
export function migrate(
  input: unknown,
  registry: MigrationRegistry = MIGRATIONS,
): Result<Readonly<Record<string, unknown>>, MigrationError> {
  if (!isRecord(input)) return err({ code: 'NOT_VERSIONED' });
  const version = input['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version))
    return err({ code: 'NOT_VERSIONED' });
  if (version > registry.current) return err({ code: 'TOO_NEW', version });
  if (version < 1) return err({ code: 'UNSUPPORTED', version });
  let document = input;
  for (let step = version; step < registry.current; step += 1) {
    const migration = registry.steps.get(step);
    if (migration === undefined) return err({ code: 'UNSUPPORTED', version: step });
    document = migration(document);
    if (document['schemaVersion'] !== step + 1) return err({ code: 'UNSUPPORTED', version: step });
  }
  return ok(document);
}
