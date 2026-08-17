import type { InputHTMLAttributes } from 'react';
import { CheckIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
};

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2', className)}>
      <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
        <input
          {...props}
          id={id}
          type="checkbox"
          className="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className={cx(
            'pointer-events-none flex h-4.5 w-4.5 items-center justify-center rounded-[5px] border border-border bg-surface text-white transition-colors',
            'peer-hover:border-accent/60',
            'peer-checked:border-accent peer-checked:bg-accent peer-checked:[&_svg]:opacity-100',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/35',
            'peer-disabled:opacity-55',
          )}
        >
          <CheckIcon className="h-3.5 w-3.5 opacity-0" />
        </span>
      </span>
      {label ? <span className="text-sm text-fg">{label}</span> : null}
    </label>
  );
}
