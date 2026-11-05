import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import styles from './Dialog.module.css';

/** Number of open dialogs; global shortcuts stay inactive while any dialog is open. */
export const openDialogCount = signal(0);

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ComponentChildren;
  readonly actions?: ComponentChildren;
  readonly size?: 'md' | 'lg';
  readonly tone?: 'default' | 'danger';
}

/**
 * Modal dialog on the native `<dialog>` element: focus is trapped and Esc closes it. Glass
 * styling with a Gold hairline above the title (design plan).
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
  size = 'md',
  tone = 'default',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null || !open) return undefined;
    if (!dialog.open) dialog.showModal();
    openDialogCount.value += 1;
    const onCancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      openDialogCount.value -= 1;
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={ref}
      class={`${styles.dialog} ${size === 'lg' ? styles.large : ''} ${tone === 'danger' ? styles.danger : ''}`}
      aria-labelledby={titleId}
    >
      <div class={styles.inner}>
        <h2 id={titleId} class={styles.title}>
          {title}
        </h2>
        <div class={styles.body}>{children}</div>
        {actions !== undefined && <div class={styles.actions}>{actions}</div>}
      </div>
    </dialog>
  );
}
