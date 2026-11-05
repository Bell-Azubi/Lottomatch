import type {
  DisplayOpenResult,
  ScreenControl,
  StorageInfo,
  StoragePersistence,
} from '../application/ports';

interface ScreenDetailed {
  readonly availLeft: number;
  readonly availTop: number;
  readonly availWidth: number;
  readonly availHeight: number;
  readonly isPrimary: boolean;
}

interface ScreenDetails {
  readonly screens: readonly ScreenDetailed[];
  readonly currentScreen: ScreenDetailed;
}

type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> };

export const DISPLAY_WINDOW_NAME = 'lottomatch-display';

async function windowManagementState(): Promise<PermissionState | 'unsupported'> {
  try {
    const status = await navigator.permissions.query({
      name: 'window-management' as PermissionName,
    });
    return status.state;
  } catch {
    return 'unsupported';
  }
}

/**
 * Places the display window on another screen when the Window Management API is available and
 * permitted (Chromium). The window is opened first, so the click's user activation is not lost.
 */
async function placeOnSecondScreen(target: Window): Promise<void> {
  const host = window as WindowWithScreens;
  if (host.getScreenDetails === undefined) return;
  if ((await windowManagementState()) === 'denied') return;
  try {
    const details = await host.getScreenDetails();
    const other = details.screens.find((screen) => screen !== details.currentScreen);
    if (other === undefined) return;
    target.moveTo(other.availLeft, other.availTop);
    target.resizeTo(other.availWidth, other.availHeight);
  } catch {
    // Permission declined or the window was closed: it stays where the browser put it.
  }
}

export class BrowserScreenControl implements ScreenControl {
  async openDisplay(url: string): Promise<DisplayOpenResult> {
    const opened = window.open(url, DISPLAY_WINDOW_NAME, 'popup=yes,width=1280,height=720');
    if (opened === null) return 'BLOCKED';
    await placeOnSecondScreen(opened);
    return 'OPENED';
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (this.isFullscreen()) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen needs a user gesture in some browsers; the UI offers a click target.
    }
  }

  isFullscreen(): boolean {
    return (document.fullscreenElement ?? null) !== null;
  }

  download(fileName: string, content: Blob): void {
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10_000);
  }
}

export class BrowserStorageInfo implements StorageInfo {
  constructor(private readonly manager: StorageManager | undefined) {}

  async persist(): Promise<StoragePersistence> {
    const manager = this.manager;
    if (manager?.persist === undefined) return 'UNSUPPORTED';
    try {
      if (await manager.persisted()) return 'PERSISTED';
      return (await manager.persist()) ? 'PERSISTED' : 'BEST_EFFORT';
    } catch {
      return 'UNSUPPORTED';
    }
  }

  async estimate(): Promise<{ usage: number; quota: number } | undefined> {
    try {
      const estimate = await this.manager?.estimate();
      if (estimate?.usage === undefined || estimate.quota === undefined) return undefined;
      return { usage: estimate.usage, quota: estimate.quota };
    } catch {
      return undefined;
    }
  }
}
