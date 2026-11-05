import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import { dismissToast, toasts, type ToastItem } from './toast-store';
import styles from './Toaster.module.css';

function ToastView({
  item,
  closeLabel,
}: {
  readonly item: ToastItem;
  readonly closeLabel: string;
}) {
  return (
    <div class={`${styles.toast} ${styles[item.tone]}`}>
      <p class={styles.message}>{item.message}</p>
      {item.action !== undefined && (
        <button type="button" class={styles.action} onClick={item.action.run}>
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        class={styles.close}
        aria-label={closeLabel}
        onClick={() => {
          dismissToast(item.id);
        }}
      >
        ×
      </button>
    </div>
  );
}

/** Live regions for toasts: polite for information, assertive for errors. */
export function Toaster() {
  const closeLabel = t(commonText).actions.close;
  const items = toasts.value;
  return (
    <div class={`${styles.region} no-print`}>
      <div aria-live="polite" class={styles.stack}>
        {items
          .filter((item) => item.tone !== 'error')
          .map((item) => (
            <ToastView key={item.id} item={item} closeLabel={closeLabel} />
          ))}
      </div>
      <div role="alert" class={styles.stack}>
        {items
          .filter((item) => item.tone === 'error')
          .map((item) => (
            <ToastView key={item.id} item={item} closeLabel={closeLabel} />
          ))}
      </div>
    </div>
  );
}
