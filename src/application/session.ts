import { batch, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { Catalogue } from '../domain/catalogue';
import { applyEnvelope } from '../domain/reducer';
import { err, ok, type Result } from '../domain/result';
import type { MatchSettings } from '../domain/settings';
import type { GameState } from '../domain/state';
import type { AuditChange, LogEnvelope, LogEvent } from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';
import type { Clock, DocumentStore, EventStore, IdGenerator } from './ports';
import type { CatalogueRecord, MatchRecord } from './records';
import type { WriteQueue } from './write-queue';

export interface SessionDeps {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly events: EventStore;
  readonly documents: DocumentStore;
  readonly queue: WriteQueue;
  /** Whether this window controls the event; read-only windows never write. */
  readonly canWrite: () => boolean;
  /** Called after the log up to `logSeq` is durably stored. */
  readonly onPersisted: (matchId: string, logSeq: number) => void;
}

export type WriteError = 'READ_ONLY';

/**
 * The active event in memory: match document, prize catalogue, log and derived game state.
 * Every change goes through the commit pipeline: append in memory → signals → ordered write
 * queue. Signals update synchronously, so the UI never waits for storage.
 */
export class MatchSession {
  readonly match: Signal<MatchRecord>;
  readonly catalogue: Signal<CatalogueRecord>;
  readonly game: Signal<GameState>;
  private readonly version = signal(0);
  private readonly entries: LogEnvelope[];

  constructor(
    private readonly deps: SessionDeps,
    match: MatchRecord,
    catalogue: CatalogueRecord,
    log: readonly LogEnvelope[],
    state: GameState,
  ) {
    this.match = signal(match);
    this.catalogue = signal(catalogue);
    this.game = signal(state);
    this.entries = [...log];
  }

  get matchId(): string {
    return this.match.value.id;
  }

  /** Increments with every appended log entry. */
  get logVersion(): ReadonlySignal<number> {
    return this.version;
  }

  /** The in-memory log (hashes are only present in the persisted copy). */
  get log(): readonly LogEnvelope[] {
    return this.entries;
  }

  /** True once the first round has started; later document changes are audited. */
  get started(): boolean {
    return this.game.value.phase !== 'READY' || this.game.value.rounds.size > 0;
  }

  /** Appends validated events and schedules their persistence. */
  commit(events: readonly LogEvent[]): Result<readonly LogEnvelope[], WriteError> {
    if (!this.deps.canWrite()) return err('READ_ONLY');
    if (events.length === 0) return ok([]);
    let seq = this.game.value.lastLogSeq;
    const envelopes = events.map((event): LogEnvelope => ({
      id: this.deps.ids.next(),
      matchId: this.matchId,
      seq: (seq += 1),
      at: this.deps.clock.nowIso(),
      schemaVersion: SCHEMA_VERSION,
      event,
    }));
    batch(() => {
      let state = this.game.value;
      for (const envelope of envelopes) state = applyEnvelope(state, envelope);
      this.entries.push(...envelopes);
      this.game.value = state;
      this.version.value += 1;
    });
    const matchId = this.matchId;
    void this.deps.queue
      .enqueue(() => this.deps.events.append(matchId, envelopes))
      .then(() => {
        this.deps.onPersisted(matchId, seq);
      });
    return ok(envelopes);
  }

  /** Replaces the settings document; audited once the event has started. */
  updateSettings(
    settings: MatchSettings,
    changes: readonly AuditChange[],
  ): Result<void, WriteError> {
    if (!this.deps.canWrite()) return err('READ_ONLY');
    const current = this.match.value;
    const next: MatchRecord = {
      ...current,
      settings,
      settingsVersion: current.settingsVersion + 1,
      updatedAt: this.deps.clock.nowIso(),
    };
    this.match.value = next;
    void this.deps.queue.enqueue(() => this.deps.documents.putMatch(next));
    if (this.started && changes.length > 0) this.commit([{ type: 'SETTINGS_CHANGED', changes }]);
    return ok(undefined);
  }

  /** Updates match metadata that is not part of the settings (backup time, archive flag). */
  updateRecord(
    patch: Partial<Pick<MatchRecord, 'archived' | 'lastBackupAt'>>,
  ): Result<void, WriteError> {
    if (!this.deps.canWrite()) return err('READ_ONLY');
    const next: MatchRecord = {
      ...this.match.value,
      ...patch,
      updatedAt: this.deps.clock.nowIso(),
    };
    this.match.value = next;
    void this.deps.queue.enqueue(() => this.deps.documents.putMatch(next));
    return ok(undefined);
  }

  /** Replaces the prize catalogue; audited once the event has started. */
  updateCatalogue(
    catalogue: Catalogue,
    action: string,
    rounds: readonly number[],
  ): Result<void, WriteError> {
    if (!this.deps.canWrite()) return err('READ_ONLY');
    const next: CatalogueRecord = {
      matchId: this.matchId,
      version: this.catalogue.value.version + 1,
      prizes: catalogue.prizes,
    };
    this.catalogue.value = next;
    void this.deps.queue.enqueue(() => this.deps.documents.putCatalogue(next));
    if (this.started)
      this.commit([
        { type: 'PRIZES_CHANGED', action, rounds: [...new Set(rounds)].sort((a, b) => a - b) },
      ]);
    return ok(undefined);
  }

  /** Reloads the in-memory copy after another window changed the stored event. */
  replaceAll(
    match: MatchRecord,
    catalogue: CatalogueRecord,
    log: readonly LogEnvelope[],
    state: GameState,
  ): void {
    batch(() => {
      this.match.value = match;
      this.catalogue.value = catalogue;
      this.entries.splice(0, this.entries.length, ...log);
      this.game.value = state;
      this.version.value += 1;
    });
  }
}
