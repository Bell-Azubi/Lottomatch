import { signal, type ReadonlySignal } from '@preact/signals';

export interface PwaStatus {
  readonly supported: boolean;
  readonly registered: boolean;
  readonly offlineReady: boolean;
  /** A new version is installed and waits; it is applied only on request (never mid-round). */
  readonly updateReady: boolean;
  readonly failed: boolean;
}

/** Service-worker state for the readiness checklist, the about page and the update prompt. */
export class PwaState {
  private readonly state = signal<PwaStatus>({
    supported: false,
    registered: false,
    offlineReady: false,
    updateReady: false,
    failed: false,
  });
  private applyUpdate: () => Promise<void> = () => Promise.resolve();

  get status(): ReadonlySignal<PwaStatus> {
    return this.state;
  }

  private patch(patch: Partial<PwaStatus>): void {
    this.state.value = { ...this.state.value, ...patch };
  }

  connect(supported: boolean, apply: () => Promise<void>): void {
    this.applyUpdate = apply;
    this.patch({ supported });
  }

  markRegistered(controlled: boolean): void {
    this.patch({ registered: true, ...(controlled ? { offlineReady: true } : {}) });
  }

  markOfflineReady(): void {
    this.patch({ offlineReady: true });
  }

  markUpdateReady(): void {
    this.patch({ updateReady: true });
  }

  markFailed(): void {
    this.patch({ failed: true });
  }

  /** Activates the waiting version; every window of the app then reloads. */
  apply(): Promise<void> {
    return this.applyUpdate();
  }
}
