import { replay } from '../domain/reducer';
import { err, ok, type Result } from '../domain/result';
import type { GameState } from '../domain/state';
import type { LogEnvelope } from '../domain/types';
import { migrate } from './migrations';
import type { DocumentStore, EventStore } from './ports';
import type { CatalogueRecord, MatchRecord } from './records';
import { parseCatalogue, parseEnvelope, parseMatch } from './schemas';

export interface LoadedMatch {
  readonly match: MatchRecord;
  readonly catalogue: CatalogueRecord;
  readonly log: readonly LogEnvelope[];
  readonly state: GameState;
}

export type LoadFailure =
  | { readonly code: 'MATCH_CORRUPT' }
  | { readonly code: 'CATALOGUE_CORRUPT' }
  | { readonly code: 'LOG_CORRUPT'; readonly seq: number; readonly reason: string };

/** Validates every stored match document; invalid ones are reported, never silently dropped. */
export function parseMatches(raw: readonly unknown[]): { valid: MatchRecord[]; invalid: number } {
  const valid: MatchRecord[] = [];
  let invalid = 0;
  for (const entry of raw) {
    const match = parseMatch(entry);
    if (match === undefined) invalid += 1;
    else valid.push(match);
  }
  return { valid, invalid };
}

/** Validates, migrates and replays a stored log. */
export function validateLog(
  raw: readonly unknown[],
): Result<{ log: LogEnvelope[]; state: GameState }, LoadFailure> {
  const log: LogEnvelope[] = [];
  for (const [index, entry] of raw.entries()) {
    const migrated = migrate(entry);
    const envelope = migrated.ok ? parseEnvelope(migrated.value) : undefined;
    if (envelope === undefined) {
      const reason = migrated.ok ? 'INVALID_ENVELOPE' : migrated.error.code;
      return err({ code: 'LOG_CORRUPT', seq: index + 1, reason });
    }
    log.push(envelope);
  }
  const replayed = replay(log);
  if (!replayed.ok) {
    return err({ code: 'LOG_CORRUPT', seq: replayed.error.seq, reason: replayed.error.cause.code });
  }
  return ok({ log, state: replayed.value });
}

/** Loads one event from storage and rebuilds its state. */
export async function loadMatch(
  documents: DocumentStore,
  events: EventStore,
  match: MatchRecord,
): Promise<Result<LoadedMatch, LoadFailure>> {
  const rawCatalogue = await documents.getCatalogue(match.id);
  const catalogue =
    rawCatalogue === undefined
      ? { matchId: match.id, version: 0, prizes: [] }
      : parseCatalogue(rawCatalogue);
  if (catalogue === undefined) return err({ code: 'CATALOGUE_CORRUPT' });
  const validated = validateLog(await events.load(match.id));
  if (!validated.ok) return validated;
  return ok({ match, catalogue, ...validated.value });
}
