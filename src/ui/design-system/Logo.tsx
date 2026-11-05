import { useState } from 'preact/hooks';
import { commonText } from '../../i18n/catalogues';
import { t } from '../../i18n';
import styles from './Logo.module.css';

/** The one asset path of the club badge; a vector or ≥ 1024 px version can replace it in place. */
export const LOGO_URL = `${import.meta.env.BASE_URL}brand/fclk-logo.png`;
/** Intrinsic size of the supplied badge after trimming its transparent padding. */
export const LOGO_SIZE = 139;

/**
 * The supplied badge, unmodified (no recolouring, effects or crops), never upscaled beyond its
 * intrinsic resolution; clear space of a quarter of its diameter around it. The size cap follows
 * the file that actually loaded, so a larger replacement grows to its intended size on big
 * screens without a code change.
 */
export function Logo({ size = 'host' }: { readonly size?: 'host' | 'display' | 'print' }) {
  const [intrinsic, setIntrinsic] = useState(LOGO_SIZE);
  return (
    <span
      class={`${styles.clearSpace} ${styles[size]}`}
      style={intrinsic === LOGO_SIZE ? undefined : { '--logo-max': `${intrinsic}px` }}
    >
      <img
        class={styles.logo}
        src={LOGO_URL}
        alt={t(commonText).logoAlt}
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        decoding="async"
        onLoad={(event) => {
          // A vector without intrinsic size reports 0: keep the cap of the supplied badge.
          const width = event.currentTarget.naturalWidth;
          if (width > 0) setIntrinsic(width);
        }}
      />
    </span>
  );
}
