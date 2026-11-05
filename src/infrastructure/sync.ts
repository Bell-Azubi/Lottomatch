import type { SyncTransport } from '../application/ports';
import type { SyncMessage } from '../application/sync-messages';

export const CHANNEL_NAME = 'lottomatch-live';
const STORAGE_KEY = 'lottomatch-live:sync';

type Handler = (message: unknown) => void;

/** BroadcastChannel transport: same-origin windows of this browser. */
export class BroadcastTransport implements SyncTransport {
  private readonly handlers = new Set<Handler>();

  constructor(private readonly channel: BroadcastChannel) {
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      for (const handler of this.handlers) handler(event.data);
    });
  }

  publish(message: SyncMessage): void {
    this.channel.postMessage(message);
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

/**
 * Fallback via `storage` events, which fire in every other window of the origin when a key
 * changes. Each message carries a nonce so identical consecutive messages still fire.
 */
export class StorageEventTransport implements SyncTransport {
  private readonly handlers = new Set<Handler>();
  private nonce = 0;

  constructor(private readonly storage: Storage) {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || event.newValue === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.newValue);
      } catch {
        return;
      }
      const message =
        typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? parsed.message
          : undefined;
      for (const handler of this.handlers) handler(message);
    });
  }

  publish(message: SyncMessage): void {
    this.nonce += 1;
    try {
      this.storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ nonce: `${Date.now()}-${this.nonce}`, message }),
      );
    } catch {
      // Storage full or blocked: the display falls back to the persisted state.
    }
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

/** Picks BroadcastChannel where available, else `storage` events, else a no-op transport. */
export function createSyncTransport(): SyncTransport {
  if (typeof BroadcastChannel === 'function')
    return new BroadcastTransport(new BroadcastChannel(CHANNEL_NAME));
  try {
    return new StorageEventTransport(window.localStorage);
  } catch {
    return { publish: () => undefined, subscribe: () => () => undefined };
  }
}
