import { effect, signal, type ReadonlySignal } from '@preact/signals';
import type { AppStore } from './app-store';
import type { HostController } from './host-controller';
import { buildSnapshot } from './snapshot';
import { parseSyncMessage, type DisplaySnapshot, type SyncMessage } from './sync-messages';

export type ControlState = 'PENDING' | 'CONTROLLING' | 'READ_ONLY';

export interface DisplayStatus {
  readonly connected: boolean;
  readonly synced: boolean;
}

/** A display counts as connected while its heartbeat is younger than this. */
export const DISPLAY_TIMEOUT_MS = 5_000;
/** How long a takeover waits for the controlling window to flush and hand over. */
export const TAKEOVER_WAIT_MS = 2_000;

/**
 * Host side of the window protocol: exactly one controlling window (Web Locks), snapshot
 * publication with `(epoch, seq)` ordering, display heartbeats and the takeover handshake.
 */
export class HostLink {
  private readonly controlState = signal<ControlState>('PENDING');
  private readonly displayState = signal<DisplayStatus>({ connected: false, synced: false });
  private epoch = 0;
  private seq = 0;
  private latest: DisplaySnapshot | undefined;
  private lastHeartbeat: { at: number; epoch: number; seq: number } | undefined;
  private stopPublishing: () => void = () => undefined;
  private handover: (() => void) | undefined;
  private readonly disposers: (() => void)[] = [];

  constructor(
    private readonly app: AppStore,
    private readonly host: HostController,
    private readonly windowId: string,
  ) {}

  get control(): ReadonlySignal<ControlState> {
    return this.controlState;
  }

  get display(): ReadonlySignal<DisplayStatus> {
    return this.displayState;
  }

  /** Acquires control (or opens read-only) before the event is loaded. */
  async start(): Promise<void> {
    const { sync, lock } = this.app.platform;
    this.app.setWriteGuard(
      () => this.controlState.value === 'CONTROLLING' && !this.app.queue.status.value.fatal,
    );
    this.app.onPersisted((matchId, logSeq) => {
      sync.publish({ t: 'persisted', matchId, logSeq });
    });
    this.disposers.push(sync.subscribe((raw) => void this.handle(parseSyncMessage(raw))));
    const timer = setInterval(() => {
      this.refreshDisplayStatus();
    }, 1_000);
    this.disposers.push(() => {
      clearInterval(timer);
    });
    const outcome = await lock.acquire(() => {
      this.loseControl();
    });
    if (outcome === 'ACQUIRED') await this.becomeController();
    else this.controlState.value = 'READ_ONLY';
  }

  /** Steuerung übernehmen: asks the controlling window to flush, then takes the lock. */
  async takeOver(): Promise<void> {
    const { sync, lock } = this.app.platform;
    const ready = new Promise<void>((resolve) => {
      this.handover = resolve;
      setTimeout(resolve, TAKEOVER_WAIT_MS);
    });
    sync.publish({ t: 'takeover-request', from: this.windowId });
    await ready;
    this.handover = undefined;
    await lock.steal(() => {
      this.loseControl();
    });
    await this.becomeController();
    await this.app.reloadActive();
    this.app.session.value?.commit([{ type: 'CONTROL_TAKEN_OVER' }]);
  }

  /** Stops timers and subscriptions. */
  dispose(): void {
    this.stopPublishing();
    for (const dispose of this.disposers.splice(0)) dispose();
  }

  private async becomeController(): Promise<void> {
    const { documents } = this.app.platform;
    const stored = await documents.getMeta('hostEpoch');
    this.epoch = (typeof stored === 'number' && Number.isSafeInteger(stored) ? stored : 0) + 1;
    await documents.setMeta('hostEpoch', this.epoch);
    this.seq = 0;
    this.controlState.value = 'CONTROLLING';
    this.stopPublishing();
    this.stopPublishing = effect(() => {
      this.publish();
    });
  }

  private loseControl(): void {
    this.stopPublishing();
    this.stopPublishing = () => undefined;
    this.controlState.value = 'READ_ONLY';
  }

  private publish(): void {
    const session = this.app.session.value;
    if (this.controlState.value !== 'CONTROLLING' || session === undefined) return;
    const reveal = this.host.reveal.state.value;
    this.seq += 1;
    const snapshot = buildSnapshot({
      epoch: this.epoch,
      seq: this.seq,
      matchId: session.matchId,
      kind: session.match.value.kind,
      settings: session.match.value.settings,
      catalogue: session.catalogue.value,
      game: session.game.value,
      prefs: this.app.prefs.value,
      reveal:
        reveal === undefined
          ? undefined
          : { key: reveal.key, durationMs: reveal.durationMs, instant: reveal.instant },
      overlay: this.host.overlays.state.value,
    });
    this.latest = snapshot;
    this.app.platform.sync.publish({ t: 'snapshot', snapshot });
  }

  private refreshDisplayStatus(): void {
    const beat = this.lastHeartbeat;
    const connected =
      beat !== undefined && this.app.platform.clock.nowMs() - beat.at < DISPLAY_TIMEOUT_MS;
    const latest = this.latest;
    const synced =
      connected && beat.epoch === latest?.epoch && beat.seq === latest.seq;
    const current = this.displayState.value;
    if (current.connected !== connected || current.synced !== synced)
      this.displayState.value = { connected, synced };
  }

  private async handle(message: SyncMessage | undefined): Promise<void> {
    if (message === undefined) return;
    const { sync } = this.app.platform;
    switch (message.t) {
      case 'hello':
        if (
          message.role === 'display' &&
          this.latest !== undefined &&
          this.controlState.value === 'CONTROLLING'
        ) {
          sync.publish({ t: 'snapshot', snapshot: this.latest });
        }
        return;
      case 'display-alive':
        this.lastHeartbeat = {
          at: this.app.platform.clock.nowMs(),
          epoch: message.epoch,
          seq: message.seq,
        };
        this.refreshDisplayStatus();
        return;
      case 'persisted':
        if (
          this.controlState.value === 'READ_ONLY' &&
          message.matchId === this.app.session.value?.matchId
        ) {
          await this.app.reloadActive();
        }
        return;
      case 'takeover-request':
        if (this.controlState.value !== 'CONTROLLING' || message.from === this.windowId) return;
        await this.app.queue.flush();
        this.loseControl();
        this.app.platform.lock.release();
        sync.publish({ t: 'takeover-ready', to: message.from });
        return;
      case 'takeover-ready':
        if (message.to === this.windowId) this.handover?.();
        return;
      case 'snapshot':
      case 'reload':
        return;
    }
  }
}
