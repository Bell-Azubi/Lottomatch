import { useEffect, useState } from 'preact/hooks';
import type { ImageStore } from '../../application/ports';
import styles from './PrizeImage.module.css';

/**
 * Object URL for a stored prize image; revoked when the id changes or the component unmounts.
 * A missing image (deleted while referenced) yields `undefined`, never an error.
 */
export function useImageUrl(images: ImageStore, imageId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUrl(undefined);
    if (imageId === undefined) return undefined;
    let active = true;
    let created: string | undefined;
    images
      .get(imageId)
      .then((image) => {
        if (!active || image === undefined) return;
        created = URL.createObjectURL(image.blob);
        setUrl(created);
      })
      .catch(() => {
        if (active) setUrl(undefined);
      });
    return () => {
      active = false;
      if (created !== undefined) URL.revokeObjectURL(created);
    };
  }, [images, imageId]);
  return url;
}

/** Prize photo: rounded rectangle with Gold rim and Cream hairline; no circular crop. */
export function PrizeImage({
  images,
  imageId,
  alt,
  size = 'md',
}: {
  readonly images: ImageStore;
  readonly imageId: string | undefined;
  readonly alt: string;
  readonly size?: 'sm' | 'md' | 'lg' | 'display';
}) {
  const url = useImageUrl(images, imageId);
  if (url === undefined) return null;
  return (
    <span class={`${styles.frame} ${styles[size]}`}>
      <img class={styles.image} src={url} alt={alt} />
    </span>
  );
}
