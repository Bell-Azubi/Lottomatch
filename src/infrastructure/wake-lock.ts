import type { WakeLock as WakeLockPort } from '../application/ports';

/**
 * Screen Wake Lock (progressive enhancement). The browser drops the lock when the page is
 * hidden; it is re-acquired on `visibilitychange` while enabled.
 */
export class ScreenWakeLock implements WakeLockPort {
  private sentinel: WakeLockSentinel | undefined;
  private wanted = false;
  readonly supported: boolean;

  constructor(private readonly wakeLock: WakeLock | undefined) {
    this.supported = wakeLock !== undefined;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wanted) void this.acquire();
    });
  }

  private async acquire(): Promise<boolean> {
    if (this.wakeLock === undefined) return false;
    if (this.sentinel !== undefined && !this.sentinel.released) return true;
    try {
      this.sentinel = await this.wakeLock.request('screen');
      return true;
    } catch {
      return false;
    }
  }

  async enable(): Promise<boolean> {
    this.wanted = true;
    return this.acquire();
  }

  async disable(): Promise<void> {
    this.wanted = false;
    const sentinel = this.sentinel;
    this.sentinel = undefined;
    if (sentinel !== undefined && !sentinel.released) await sentinel.release();
  }
}
