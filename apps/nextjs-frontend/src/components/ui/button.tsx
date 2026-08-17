'use client';

import type { ButtonHTMLAttributes } from 'react';
import { useT } from '@/app/lib/i18n/use-t';
import { cx } from '@/lib/cx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-strong',
  secondary:
    'border border-border bg-surface text-fg hover:bg-surface-muted',
  ghost: 'text-fg hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-9 px-3.5 text-sm',
  sm: 'h-8 px-3 text-sm',
  icon: 'h-9 w-9 px-0',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const t = useT();
  return (
    <button
      {...props}
      type={type}
      disabled={disabled ?? isLoading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {isLoading ? t.common.pleaseWait : children}
    </button>
  );
}
