'use client';

import type { AccessDurationId } from '@/app/lib/access-duration';
import { ACCESS_DURATION_PRESETS } from '@/app/lib/access-duration';
import { useT } from '@/app/lib/i18n/use-t';
import { cx } from '@/lib/cx';

type AccessDurationSelectProps = {
  id: string;
  label: string;
  value: AccessDurationId;
  onChange: (value: AccessDurationId) => void;
  disabled?: boolean;
};

export function AccessDurationSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: AccessDurationSelectProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as AccessDurationId)}
        className={cx(
          'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25',
        )}
      >
        {ACCESS_DURATION_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {t.duration[preset.id]}
          </option>
        ))}
      </select>
    </div>
  );
}
