import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes,
  'class' | 'className' | 'type' | 'disabled'
> {
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'lg';
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly className?: string;
  readonly children: ComponentChildren;
}

/** Flat button for glass and page surfaces. Tactile plate controls use `NeuButton`. */
export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      class={`${styles.button} ${styles[variant]} ${size === 'lg' ? styles.large : ''} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
