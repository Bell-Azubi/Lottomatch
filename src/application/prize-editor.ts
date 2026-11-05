import {
  applyTemplate,
  clearRound,
  copyRound,
  prizeAt,
  prizeFromDraft,
  referencedImages,
  removePrize,
  upsertPrize,
  validatePrize,
  type BulkResult,
  type Catalogue,
  type PrizeDraft,
  type PrizeIssue,
  type SlotLock,
} from '../domain/catalogue';
import { isIntegerInRange } from '../domain/limits';
import { err, ok, type Result } from '../domain/result';
import type { Prize, PrizeSlot } from '../domain/types';
import type { AppStore } from './app-store';
import type { ImageError } from './ports';
import { parseCatalogue } from './schemas';
import { isAwarded } from './selectors';
import type { MatchSession } from './session';

export type PrizeEditError =
  | { readonly code: 'READ_ONLY' }
  | { readonly code: 'NO_EVENT' }
  | { readonly code: 'LOCKED' }
  | { readonly code: 'OUT_OF_RANGE' }
  | { readonly code: 'INVALID'; readonly issues: readonly PrizeIssue[] };

export type ImageUploadError = ImageError | 'READ_ONLY';

/** A prize row ready to be written, e.g. from a CSV import. */
export interface PrizeImport {
  readonly round: number;
  readonly slot: PrizeSlot;
  readonly draft: PrizeDraft;
}

interface EditContext {
  readonly session: MatchSession;
  readonly catalogue: Catalogue;
  readonly lock: SlotLock;
  readonly totalRounds: number;
}

/**
 * Prize catalogue use cases (FR-8). Awarded prizes are read-only; every change goes through the
 * session (audited once the event started) and unreferenced images are collected afterwards.
 */
export class PrizeEditor {
  /** Images uploaded in a form that has not been saved yet; protected from collection. */
  private readonly pending = new Set<string>();

  constructor(private readonly app: AppStore) {}

  private context(): Result<EditContext, PrizeEditError> {
    const session = this.app.session.value;
    if (session === undefined) return err({ code: 'NO_EVENT' });
    if (!this.app.canWrite()) return err({ code: 'READ_ONLY' });
    const game = session.game.value;
    return ok({
      session,
      catalogue: session.catalogue.value,
      lock: (round, slot) => isAwarded(game, round, slot),
      totalRounds: session.match.value.settings.rounds,
    });
  }

  private write(
    context: EditContext,
    catalogue: Catalogue,
    action: string,
    rounds: readonly number[],
  ): Result<void, PrizeEditError> {
    const written = context.session.updateCatalogue(catalogue, action, rounds);
    if (!written.ok) return err({ code: 'READ_ONLY' });
    void this.collectGarbage();
    return ok(undefined);
  }

  /** Saves the prize of a slot; validates the draft and refuses awarded or unknown slots. */
  savePrize(round: number, slot: PrizeSlot, draft: PrizeDraft): Result<Prize, PrizeEditError> {
    const context = this.context();
    if (!context.ok) return context;
    if (!isIntegerInRange(round, 1, context.value.totalRounds))
      return err({ code: 'OUT_OF_RANGE' });
    if (context.value.lock(round, slot)) return err({ code: 'LOCKED' });
    const issues = validatePrize(draft);
    if (issues.length > 0) return err({ code: 'INVALID', issues });
    const existing = prizeAt(context.value.catalogue, round, slot);
    const prize = prizeFromDraft(existing?.id ?? this.app.platform.ids.next(), round, slot, draft);
    if (prize.imageId !== undefined) this.pending.delete(prize.imageId);
    const written = this.write(
      context.value,
      upsertPrize(context.value.catalogue, prize),
      'PRIZE_SAVED',
      [round],
    );
    return written.ok ? ok(prize) : written;
  }

  /** Removes the prize of a slot, turning it into a gap. */
  removePrize(round: number, slot: PrizeSlot): Result<void, PrizeEditError> {
    const context = this.context();
    if (!context.ok) return context;
    if (context.value.lock(round, slot)) return err({ code: 'LOCKED' });
    if (prizeAt(context.value.catalogue, round, slot) === undefined) return ok(undefined);
    return this.write(
      context.value,
      removePrize(context.value.catalogue, round, slot),
      'PRIZE_REMOVED',
      [round],
    );
  }

  /** Copies the four prizes of a round to other rounds (awarded targets are skipped). */
  copyRound(from: number, targets: readonly number[]): Result<BulkResult, PrizeEditError> {
    const context = this.context();
    if (!context.ok) return context;
    const { totalRounds } = context.value;
    const valid = targets.filter(
      (round) => isIntegerInRange(round, 1, totalRounds) && round !== from,
    );
    if (!isIntegerInRange(from, 1, totalRounds) || valid.length === 0)
      return err({ code: 'OUT_OF_RANGE' });
    const ids = this.app.platform.ids;
    const result = copyRound(context.value.catalogue, from, valid, context.value.lock, () =>
      ids.next(),
    );
    const written = this.write(context.value, result.catalogue, 'ROUND_COPIED', valid);
    return written.ok ? ok(result) : written;
  }

  /** Applies the event's win-condition template to every unlocked prize. */
  applyTemplateEverywhere(): Result<BulkResult, PrizeEditError> {
    const context = this.context();
    if (!context.ok) return context;
    const { template } = context.value.session.match.value.settings;
    const result = applyTemplate(context.value.catalogue, template, context.value.lock);
    const rounds = context.value.catalogue.prizes.map((prize) => prize.round);
    const written = this.write(context.value, result.catalogue, 'TEMPLATE_APPLIED', rounds);
    return written.ok ? ok(result) : written;
  }

  /** Removes every unlocked prize of a round. */
  clearRound(round: number): Result<BulkResult, PrizeEditError> {
    const context = this.context();
    if (!context.ok) return context;
    if (!isIntegerInRange(round, 1, context.value.totalRounds))
      return err({ code: 'OUT_OF_RANGE' });
    const result = clearRound(context.value.catalogue, round, context.value.lock);
    const written = this.write(context.value, result.catalogue, 'ROUND_CLEARED', [round]);
    return written.ok ? ok(result) : written;
  }

  /** Writes imported rows in one catalogue change; locked or invalid rows are skipped. */
  importPrizes(
    rows: readonly PrizeImport[],
  ): Result<{ imported: number; skipped: number }, PrizeEditError> {
    const context = this.context();
    if (!context.ok) return context;
    let catalogue = context.value.catalogue;
    let imported = 0;
    for (const { round, slot, draft } of rows) {
      const allowed =
        isIntegerInRange(round, 1, context.value.totalRounds) &&
        !context.value.lock(round, slot) &&
        validatePrize(draft).length === 0;
      if (!allowed) continue;
      const id = prizeAt(catalogue, round, slot)?.id ?? this.app.platform.ids.next();
      catalogue = upsertPrize(catalogue, prizeFromDraft(id, round, slot, draft));
      imported += 1;
    }
    if (imported > 0) {
      const written = this.write(
        context.value,
        catalogue,
        'CSV_IMPORTED',
        rows.map((row) => row.round),
      );
      if (!written.ok) return written;
    }
    return ok({ imported, skipped: rows.length - imported });
  }

  /** Processes and stores an uploaded image; it stays protected until a form saves or releases it. */
  async storeImage(file: Blob): Promise<Result<string, ImageUploadError>> {
    if (!this.app.canWrite()) return err('READ_ONLY');
    const { imageProcessor, images, ids, clock } = this.app.platform;
    const processed = await imageProcessor.process(file);
    if (!processed.ok) return processed;
    const id = ids.next();
    this.pending.add(id);
    const { blob, width, height } = processed.value;
    await this.app.queue.enqueue(() =>
      images.put({ id, blob, width, height, createdAt: clock.nowIso() }),
    );
    return ok(id);
  }

  /** A form discarded its uploaded image; it may now be collected. */
  releaseImage(imageId: string): void {
    if (this.pending.delete(imageId)) void this.collectGarbage();
  }

  /** Deletes images no event's catalogue references any more; returns how many were removed. */
  async collectGarbage(): Promise<number> {
    const { documents, images } = this.app.platform;
    let removed = 0;
    await this.app.queue.enqueue(async () => {
      const referenced = new Set<string>(this.pending);
      const active = this.app.session.value;
      if (active !== undefined) {
        for (const id of referencedImages(active.catalogue.value)) referenced.add(id);
      }
      for (const match of this.app.matches.value) {
        if (match.id === active?.matchId) continue;
        const raw = await documents.getCatalogue(match.id);
        if (raw === undefined) continue;
        const catalogue = parseCatalogue(raw);
        // An unreadable catalogue may reference any image: keep everything.
        if (catalogue === undefined) return;
        for (const id of referencedImages(catalogue)) referenced.add(id);
      }
      for (const id of await images.listIds()) {
        if (referenced.has(id)) continue;
        await images.delete(id);
        removed += 1;
      }
    });
    return removed;
  }
}
