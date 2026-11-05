import { signal } from '@preact/signals';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface ToastItem {
  readonly id: string;
  readonly tone: ToastTone;
  readonly message: string;
  /** Persistent toasts stay until dismissed or replaced by id. */
  readonly persistent: boolean;
  readonly action?: ToastAction;
}

/** Visible toasts, newest last. */
export const toasts = signal<readonly ToastItem[]>([]);

const AUTO_DISMISS_MS = 4_500;
let counter = 0;

/** Removes a toast. */
export function dismissToast(id: string): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

/** Shows a toast; a toast with the same id replaces the previous one. */
export function showToast(
  message: string,
  options: { tone?: ToastTone; id?: string; persistent?: boolean; action?: ToastAction } = {},
): string {
  counter += 1;
  const id = options.id ?? `t${counter}`;
  const item: ToastItem = {
    id,
    message,
    tone: options.tone ?? 'info',
    persistent: options.persistent ?? false,
    ...(options.action === undefined ? {} : { action: options.action }),
  };
  toasts.value = [...toasts.value.filter((toast) => toast.id !== id), item].slice(-4);
  if (!item.persistent) {
    setTimeout(() => {
      if (toasts.value.some((toast) => toast === item)) dismissToast(id);
    }, AUTO_DISMISS_MS);
  }
  return id;
}
