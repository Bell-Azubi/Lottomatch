import { effect, signal, type ReadonlySignal } from '@preact/signals';
import type { AppStore } from './app-store';
import { buildSnapshot } from './snapshot';
import { isNewer, parseSyncMessage, type DisplaySnapshot, type SyncMessage } from './sync-messages';

/** Interval of the display heartbeat that tells the host it is connected and in sync. */
export const HEARTBEAT_MS = 2_000;

/**
 * Display side of the window protocol: renders the newest host snapshot and ignores older ones;
 * with no host present it renders the persisted state.
 */
export class DisplayLink {
  private readonly current = signal<DisplaySnapshot | undefined>(undefined);
  private readonly hostSeen = signal(false);
  private position = { epoch: -1, seq: -1 };
  private readonly disposers: (() => void)[] = [];

  constructor(
    private readonly app: AppStore,
    private readonly windowId: string,
    private readonly reload: () => void,
  ) {}

  get snapshot(): ReadonlySignal<DisplaySnapshot | undefined> {
    return this.current;
  }

  /** True once a host window has sent a snapshot. */
  get hostConnected(): ReadonlySignal<boolean> {
    return this.hostSeen;
  }

  start(): void {
    const { sync } = this.app.platform;
    this.disposers.push(sync.subscribe((raw) => void this.handle(parseSyncMessage(raw))));
    this.disposers.push(
      effect(() => {
        if (!this.hostSeen.value) this.renderPersisted();
      }),
    );
    sync.publish({ t: 'hello', role: 'display', from: this.windowId });
    const timer = setInterval(() => {
      sync.publish({ t: 'display-alive', from: this.windowId, ...this.position });
    }, HEARTBEAT_MS);
    this.disposers.push(() => {
      clearInterval(timer);
    });
  }

  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
  }

  /** Accepts a snapshot when it is newer than the one shown. */
  accept(snapshot: DisplaySnapshot): boolean {
    if (!isNewer(snapshot, this.position.epoch, this.position.seq)) return false;
    this.position = { epoch: snapshot.epoch, seq: snapshot.seq };
    this.current.value = snapshot;
    return true;
  }

  private renderPersisted(): void {
    const session = this.app.session.value;
    if (session === undefined) return;
    const snapshot = buildSnapshot({
      epoch: 0,
      seq: session.game.value.lastLogSeq,
      matchId: session.matchId,
      kind: session.match.value.kind,
      settings: session.match.value.settings,
      catalogue: session.catalogue.value,
      game: session.game.value,
      prefs: this.app.prefs.value,
      reveal: undefined,
      overlay: undefined,
    });
    this.position = { epoch: 0, seq: snapshot.seq };
    this.current.value = snapshot;
  }

  private async handle(message: SyncMessage | undefined): Promise<void> {
    if (message === undefined) return;
    switch (message.t) {
      case 'snapshot':
        if (this.accept(message.snapshot)) this.hostSeen.value = true;
        return;
      case 'persisted':
        if (!this.hostSeen.value) await this.app.reloadActive();
        return;
      case 'reload':
        this.reload();
        return;
      case 'hello':
      case 'display-alive':
      case 'takeover-request':
      case 'takeover-ready':
        return;
    }
  }
}
