import { useId, useState } from 'preact/hooks';
import type { ImageStore } from '../../../application/ports';
import type { PrizeEditor } from '../../../application/prize-editor';
import { t } from '../../../i18n';
import { Button } from '../../design-system/Button';
import { PrizeImage } from '../../design-system/PrizeImage';
import styles from './PrizeForm.module.css';
import { prizesText } from './text';

export interface ImageFieldProps {
  readonly editor: PrizeEditor;
  readonly images: ImageStore;
  readonly imageId: string | undefined;
  readonly title: string;
  readonly disabled: boolean;
  /** A new image was stored (protected until the form saves) or the image was removed. */
  readonly onChange: (imageId: string | undefined) => void;
}

/** Image upload: rejects SVG, re-encodes to WebP/JPEG ≤ 1280 px and ≤ 400 KB (FR-8). */
export function ImageField({
  editor,
  images,
  imageId,
  title,
  disabled,
  onChange,
}: ImageFieldProps) {
  const m = t(prizesText);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <div class={styles.imageField} role="group" aria-labelledby={`${id}-label`}>
      <span class={styles.fieldLabel} id={`${id}-label`}>
        {m.image.label}
      </span>
      {imageId !== undefined && (
        <PrizeImage
          images={images}
          imageId={imageId}
          alt={m.image.alt(title === '' ? m.image.label : title)}
          size="md"
        />
      )}
      <div class={styles.imageActions}>
        <input
          id={id}
          class={styles.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          disabled={disabled || busy}
          aria-describedby={`${id}-hint${error === undefined ? '' : ` ${id}-error`}`}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            input.value = '';
            if (file === undefined) return;
            setBusy(true);
            setError(undefined);
            void editor
              .storeImage(file)
              .then((result) => {
                if (result.ok) onChange(result.value);
                else setError(m.image.errors[result.error]);
              })
              .finally(() => {
                setBusy(false);
              });
          }}
        />
        <label
          class={`${styles.fileButton} ${disabled || busy ? styles.fileButtonDisabled : ''}`}
          for={id}
        >
          {busy ? m.image.processing : m.image.choose}
        </label>
        {imageId !== undefined && (
          <Button
            variant="quiet"
            disabled={disabled || busy}
            onClick={() => {
              onChange(undefined);
            }}
          >
            {m.image.remove}
          </Button>
        )}
      </div>
      <p id={`${id}-hint`} class={styles.hint}>
        {m.image.hint}
      </p>
      {error !== undefined && (
        <p id={`${id}-error`} class={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
