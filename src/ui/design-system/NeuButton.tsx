import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import styles from './NeuButton.module.css';

export interface NeuButtonProps extends Omit<
  ButtonHTMLAttributes,
  'class' | 'className' | 'type' | 'disabled'
> {
  /** key: keypad and plate controls; disc: the round Drehen button. */
  readonly shape?: 'key' | 'disc';
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly children: ComponentChildren;
}

/**
 * Neumorphic control for the opaque host plate only (never on glass). The Graphite edge keeps
 * the affordance at ≥ 3:1 without relying on the soft shadows.
 */
export function NeuButton({
  shape = 'key',
  pressed = false,
  className,
  children,
  ...rest
}: NeuButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      class={`${styles.neu} ${shape === 'disc' ? styles.disc : styles.key} ${pressed ? styles.pressed : ''} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
