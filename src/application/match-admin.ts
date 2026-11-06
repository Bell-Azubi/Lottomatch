import { cleanText, LIMITS } from '../domain/limits';
import { err, ok, type Result } from '../domain/result';
import { defaultSettings, type MatchSettings } from '../domain/settings';
import { textLength } from '../domain/win-condition';
import { zurichDate, type AppStore } from './app-store';
import type { CatalogueRecord, MatchRecord } from './records';
import { parseCatalogue } from './schemas';

export type AdminError =
  'READ_ONLY' | 'NOT_FOUND' | 'ACTIVE_EVENT' | 'LOAD_FAILED' | 'INVALID_NAME';

/** Cleans an event name; `undefined` when it is empty or longer than 80 characters. */
export function validEventName(name: string): string | undefined {
  const cleaned = cleanText(name);
  return cleaned === '' || textLength(cleaned) > LIMITS.matchName ? undefined : cleaned;
}

/** Event administration on the settings page (FR-9 events, practice mode). */
export class MatchAdmin {
  constructor(private readonly app: AppStore) {}

  private async persistNew(match: MatchRecord, catalogue: CatalogueRecord): Promise<void> {
    const { documents } = this.app.platform;
    await this.app.queue.enqueue(async () => {
      await documents.putMatch(match);
      await documents.putCatalogue(catalogue);
    });
    this.app.upsertMatchInList(match);
  }

  private copyCatalogue(source: CatalogueRecord | undefined, matchId: string): CatalogueRecord {
    const prizes = (source?.prizes ?? []).map((prize) => ({
      ...prize,
      id: this.app.platform.ids.next(),
    }));
    return { matchId, version: 1, prizes };
  }

  /** Creates an event with default settings and makes it active; opening it adds the prize list. */
  async create(name: string): Promise<Result<MatchRecord, AdminError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    const cleaned = validEventName(name);
    if (cleaned === undefined) return err('INVALID_NAME');
    const today = zurichDate(this.app.platform.clock.nowIso());
    const match = this.app.newMatchRecord('REAL', defaultSettings(cleaned, today));
    await this.persistNew(match, { matchId: match.id, version: 1, prizes: [] });
    return (await this.switchTo(match.id)).ok ? ok(match) : err('LOAD_FAILED');
  }

  /** Duplicates an event as a template: settings and prizes, never draws or winners. */
  async duplicate(sourceId: string, name: string): Promise<Result<MatchRecord, AdminError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    const cleaned = validEventName(name);
    if (cleaned === undefined) return err('INVALID_NAME');
    const source = this.app.matches.value.find((m) => m.id === sourceId);
    if (source === undefined) return err('NOT_FOUND');
    const settings: MatchSettings = { ...source.settings, name: cleaned, date: '' };
    const match = this.app.newMatchRecord('REAL', settings, source.id);
    const catalogue = await this.readCatalogue(source.id);
    await this.persistNew(match, this.copyCatalogue(catalogue, match.id));
    return ok(match);
  }

  /** Creates a separate practice event (Übung) from the active event and switches to it. */
  async startPractice(name: string): Promise<Result<MatchRecord, AdminError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    const cleaned = validEventName(name);
    if (cleaned === undefined) return err('INVALID_NAME');
    const session = this.app.session.value;
    if (session === undefined) return err('NOT_FOUND');
    const settings: MatchSettings = { ...session.match.value.settings, name: cleaned };
    const match = this.app.newMatchRecord('PRACTICE', settings, session.matchId);
    await this.persistNew(match, this.copyCatalogue(session.catalogue.value, match.id));
    return (await this.switchTo(match.id)).ok ? ok(match) : err('LOAD_FAILED');
  }

  /** Makes another event active. */
  async switchTo(matchId: string): Promise<Result<void, AdminError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    const match = this.app.matches.value.find((m) => m.id === matchId);
    if (match === undefined) return err('NOT_FOUND');
    await this.app.queue.flush();
    const unarchived = match.archived ? { ...match, archived: false } : match;
    await this.app.queue.enqueue(async () => {
      if (unarchived !== match) await this.app.platform.documents.putMatch(unarchived);
      await this.app.platform.documents.setMeta('activeMatchId', matchId);
    });
    this.app.upsertMatchInList(unarchived);
    return (await this.app.open(unarchived)) ? ok(undefined) : err('LOAD_FAILED');
  }

  /** Archives or restores an event that is not active. */
  async setArchived(matchId: string, archived: boolean): Promise<Result<void, AdminError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    if (this.app.session.value?.matchId === matchId) return err('ACTIVE_EVENT');
    const match = this.app.matches.value.find((m) => m.id === matchId);
    if (match === undefined) return err('NOT_FOUND');
    const next = { ...match, archived, updatedAt: this.app.platform.clock.nowIso() };
    await this.app.queue.enqueue(() => this.app.platform.documents.putMatch(next));
    this.app.upsertMatchInList(next);
    return ok(undefined);
  }

  /** Deletes every draw and award of the active event; settings and prizes stay (type-to-confirm). */
  async resetActive(): Promise<Result<void, AdminError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    const session = this.app.session.value;
    if (session === undefined) return err('NOT_FOUND');
    await this.app.queue.flush();
    await this.app.queue.enqueue(() => this.app.platform.events.clear(session.matchId));
    await this.app.reloadActive();
    return ok(undefined);
  }

  /** Deletes every winner name and note on this device in one action (C6), audit-logged. */
  async erasePersonalData(): Promise<Result<number, AdminError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    await this.app.queue.flush();
    let erased = 0;
    await this.app.queue.enqueue(async () => {
      for (const match of this.app.matches.value) {
        erased += await this.app.platform.events.redactPersonalData(match.id);
      }
    });
    await this.app.reloadActive();
    this.app.session.value?.commit([{ type: 'PERSONAL_DATA_ERASED', winners: erased }]);
    return ok(erased);
  }

  private async readCatalogue(matchId: string): Promise<CatalogueRecord | undefined> {
    const active = this.app.session.value;
    if (active?.matchId === matchId) return active.catalogue.value;
    return parseCatalogue(await this.app.platform.documents.getCatalogue(matchId));
  }
}
