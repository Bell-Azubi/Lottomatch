import { signal } from '@preact/signals';
import { defaultSettings } from '../domain/settings';
import { SUPERLOTTO_SLOT } from '../domain/types';
import { loadMatch, parseMatches, type LoadFailure } from './loader';
import type { StoragePersistence } from './ports';
import type { Platform } from './platform';
import { DEFAULT_PREFERENCES, type MatchKind, type MatchRecord, type Preferences } from './records';
import { parsePreferences } from './schemas';
import { isSlotLocked } from './selectors';
import { MatchSession } from './session';
import { WriteQueue } from './write-queue';

export type RecoveryCause =
  | LoadFailure
  | { readonly code: 'STORAGE_FAILED' }
  | { readonly code: 'MATCHES_CORRUPT'; readonly count: number };

export type AppPhase =
  | { readonly kind: 'BOOTING' }
  | { readonly kind: 'READY' }
  | { readonly kind: 'RECOVERY'; readonly cause: RecoveryCause; readonly matchId?: string };

export type WindowRole = 'host' | 'display';

const ZURICH_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar date in Europe/Zurich as `yyyy-MM-dd`. */
export function zurichDate(iso: string): string {
  return ZURICH_DATE.format(new Date(iso));
}

/**
 * Device-level state: preferences, the list of events and the active event session.
 * Writes go through one ordered queue shared by every document and log append.
 */
export class AppStore {
  readonly phase = signal<AppPhase>({ kind: 'BOOTING' });
  readonly prefs = signal<Preferences>(DEFAULT_PREFERENCES);
  readonly matches = signal<readonly MatchRecord[]>([]);
  readonly session = signal<MatchSession | undefined>(undefined);
  readonly persistence = signal<StoragePersistence>('UNSUPPORTED');
  readonly queue: WriteQueue;
  private writeGuard: () => boolean = () => false;
  private persistedListener: (matchId: string, logSeq: number) => void = () => undefined;

  constructor(readonly platform: Platform) {
    this.queue = new WriteQueue({ onError: (error) => platform.reportError(error, 'persist') });
  }

  /** Decides whether this window may write (set by the control module). */
  setWriteGuard(guard: () => boolean): void {
    this.writeGuard = guard;
  }

  canWrite(): boolean {
    return this.writeGuard() && this.phase.value.kind === 'READY';
  }

  /** Called after every durable log append (used to notify read-only windows). */
  onPersisted(listener: (matchId: string, logSeq: number) => void): void {
    this.persistedListener = listener;
  }

  /** Loads preferences and the active event; opens the recovery screen on corrupt data. */
  async boot(role: WindowRole): Promise<void> {
    const { documents } = this.platform;
    try {
      this.prefs.value =
        parsePreferences(await documents.getMeta('preferences')) ?? DEFAULT_PREFERENCES;
      const { valid, invalid } = parseMatches(await documents.listMatches());
      if (invalid > 0) {
        this.phase.value = { kind: 'RECOVERY', cause: { code: 'MATCHES_CORRUPT', count: invalid } };
        return;
      }
      let matches = valid;
      if (matches.length === 0 && role === 'host' && this.writeGuard()) {
        const today = zurichDate(this.platform.clock.nowIso());
        const created = this.newMatchRecord('REAL', defaultSettings('Lottomatch', today));
        await documents.putMatch(created);
        await documents.setMeta('activeMatchId', created.id);
        matches = [created];
      }
      this.matches.value = sortMatches(matches);
      const activeId = await documents.getMeta('activeMatchId');
      const active =
        matches.find((m) => m.id === activeId) ?? matches.find((m) => !m.archived) ?? matches[0];
      if (active === undefined) {
        this.phase.value = { kind: 'READY' };
        return;
      }
      await this.open(active);
      if (role === 'host') this.persistence.value = await this.platform.storage.persist();
    } catch (error: unknown) {
      this.platform.reportError(error, 'boot');
      this.phase.value = { kind: 'RECOVERY', cause: { code: 'STORAGE_FAILED' } };
    }
  }

  /** Opens an event as the active session. */
  async open(match: MatchRecord): Promise<boolean> {
    const { documents, events } = this.platform;
    const loaded = await loadMatch(documents, events, match);
    if (!loaded.ok) {
      this.phase.value = { kind: 'RECOVERY', cause: loaded.error, matchId: match.id };
      return false;
    }
    const { catalogue, log, state } = loaded.value;
    const session = new MatchSession(
      {
        clock: this.platform.clock,
        ids: this.platform.ids,
        events,
        documents,
        queue: this.queue,
        canWrite: () => this.canWrite(),
        onPersisted: (matchId, logSeq) => {
          this.persistedListener(matchId, logSeq);
        },
      },
      match,
      catalogue,
      log,
      state,
    );
    this.session.value = session;
    this.phase.value = { kind: 'READY' };
    this.addPrizeList(session);
    return true;
  }

  /**
   * An event without any prize gets the prize list, also while it is being played; an event that is
   * over stays as it was. A round that started without a Superlotto cannot play one (ADR-0028).
   */
  private addPrizeList(session: MatchSession): void {
    const game = session.game.value;
    if (!this.canWrite() || session.catalogue.value.prizes.length > 0) return;
    if (game.phase === 'COMPLETED') return;
    const { rounds } = session.match.value.settings;
    const prizes = this.platform.initialPrizes.filter(
      (prize) =>
        prize.round <= rounds &&
        (prize.slot !== SUPERLOTTO_SLOT || !isSlotLocked(game, prize.round, prize.slot)),
    );
    if (prizes.length === 0) return;
    const changed = prizes.map((prize) => prize.round);
    session.updateCatalogue({ prizes }, 'PRIZE_LIST_ADDED', changed);
  }

  /** Re-reads the active event from storage (after another window wrote it). */
  async reloadActive(): Promise<void> {
    const session = this.session.value;
    if (session === undefined) return;
    const { valid } = parseMatches(await this.platform.documents.listMatches());
    this.matches.value = sortMatches(valid);
    const match = valid.find((m) => m.id === session.matchId);
    if (match === undefined) return;
    const loaded = await loadMatch(this.platform.documents, this.platform.events, match);
    if (!loaded.ok) {
      this.phase.value = { kind: 'RECOVERY', cause: loaded.error, matchId: match.id };
      return;
    }
    session.replaceAll(
      loaded.value.match,
      loaded.value.catalogue,
      loaded.value.log,
      loaded.value.state,
    );
  }

  /** Updates device preferences and stores them. */
  setPreferences(patch: Partial<Preferences>): void {
    const next = { ...this.prefs.value, ...patch };
    this.prefs.value = next;
    if (this.writeGuard())
      void this.queue.enqueue(() => this.platform.documents.setMeta('preferences', next));
  }

  /** A new match document with fresh identity. */
  newMatchRecord(
    kind: MatchKind,
    settings: MatchRecord['settings'],
    sourceMatchId?: string,
  ): MatchRecord {
    const now = this.platform.clock.nowIso();
    return {
      id: this.platform.ids.next(),
      kind,
      createdAt: now,
      updatedAt: now,
      archived: false,
      settings,
      settingsVersion: 1,
      ...(sourceMatchId === undefined ? {} : { sourceMatchId }),
    };
  }

  /** Replaces a match document in the list (keeps the list sorted). */
  upsertMatchInList(match: MatchRecord): void {
    this.matches.value = sortMatches([
      ...this.matches.value.filter((m) => m.id !== match.id),
      match,
    ]);
  }
}

/** Newest events first; archived events last. */
export function sortMatches(matches: readonly MatchRecord[]): MatchRecord[] {
  return [...matches].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || b.createdAt.localeCompare(a.createdAt),
  );
}
