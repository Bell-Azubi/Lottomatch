import type { ComponentChildren, HTMLAttributes } from 'preact';
import styles from './Surface.module.css';

interface SurfaceProps extends Omit<HTMLAttributes<HTMLElement>, 'class' | 'className' | 'ref'> {
  readonly as?: 'div' | 'section' | 'header' | 'aside' | 'footer' | 'nav';
  readonly className?: string;
  readonly children: ComponentChildren;
}

/** Translucent glass for floating layers only: header, prize bar, overlays, dialogs. */
export function Glass({ as: Tag = 'div', className, children, ...rest }: SurfaceProps) {
  return (
    <Tag {...rest} class={`${styles.glass} ${className ?? ''}`}>
      {children}
    </Tag>
  );
}

/** Opaque plate that carries the tactile controls of the host console. */
export function Plate({ as: Tag = 'section', className, children, ...rest }: SurfaceProps) {
  return (
    <Tag {...rest} class={`${styles.plate} ${className ?? ''}`}>
      {children}
    </Tag>
  );
}

/** Plain page panel with a hairline, used on content pages. */
export function Panel({ as: Tag = 'section', className, children, ...rest }: SurfaceProps) {
  return (
    <Tag {...rest} class={`${styles.panel} ${className ?? ''}`}>
      {children}
    </Tag>
  );
}
