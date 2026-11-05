import type { HostLock, LockOutcome } from '../application/ports';

export const LOCK_NAME = 'lottomatch-live-host';

/**
 * Exactly one controlling window via the Web Locks API. The lock is held by a promise that only
 * resolves on release; a steal from another window rejects it, which reports the loss.
 */
export class WebHostLock implements HostLock {
  private releaseHeld: (() => void) | undefined;

  constructor(private readonly locks: LockManager | undefined) {}

  private hold(options: LockOptions, onLost: () => void): Promise<boolean> {
    const locks = this.locks;
    if (locks === undefined) return Promise.resolve(true);
    return new Promise<boolean>((resolveAcquired) => {
      locks
        .request(LOCK_NAME, options, (lock) => {
          if (lock === null) {
            resolveAcquired(false);
            return undefined;
          }
          resolveAcquired(true);
          return new Promise<void>((release) => {
            this.releaseHeld = release;
          });
        })
        .catch(() => {
          this.releaseHeld = undefined;
          onLost();
        });
    });
  }

  async acquire(onLost: () => void): Promise<LockOutcome> {
    const acquired = await this.hold({ mode: 'exclusive', ifAvailable: true }, onLost);
    return acquired ? 'ACQUIRED' : 'HELD_ELSEWHERE';
  }

  async steal(onLost: () => void): Promise<void> {
    await this.hold({ mode: 'exclusive', steal: true }, onLost);
  }

  release(): void {
    this.releaseHeld?.();
    this.releaseHeld = undefined;
  }
}
