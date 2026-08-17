'use client';

import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useState } from 'react';
import { useT } from '@/app/lib/i18n/use-t';
import { cx } from '@/lib/cx';
import { EyeIcon, EyeOffIcon } from './icons';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

export function TextField({
  label,
  error,
  hint,
  trailing,
  id,
  ref,
  type,
  className,
  ...props
}: TextFieldProps) {
  const t = useT();
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const inputType = isPassword && revealed ? 'text' : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          ref={ref}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={cx(
            'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25 aria-invalid:border-danger',
            isPassword || trailing ? 'pr-10' : '',
            className,
          )}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-fg"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? t.auth.hidePassword : t.auth.showPassword}
          >
            {revealed ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        ) : trailing ? (
          <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
            {trailing}
          </div>
        ) : null}
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
