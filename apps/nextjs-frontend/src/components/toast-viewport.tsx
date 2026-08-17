'use client';

import { CloseIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';
import { cx } from '@/lib/cx';
import { useToastStore } from '@/store/toast.store';

export function ToastViewport() {
  const t = useT();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-80 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'danger' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm leading-5 shadow-[0_16px_40px_rgb(17_29_50/0.14)] dark:shadow-[0_16px_40px_rgb(0_0_0/0.45)]',
            toast.tone === 'danger'
              ? 'border-danger/30 bg-surface text-danger'
              : toast.tone === 'success'
                ? 'border-accent/30 bg-surface text-fg'
                : 'border-border bg-surface text-fg',
          )}
        >
          <p className="min-w-0 flex-1">{toast.message}</p>
          <button
            type="button"
            aria-label={t.common.hide}
            className="relative inline-flex size-5 shrink-0 items-center justify-center text-current hover:opacity-70 after:absolute after:-inset-2 after:content-['']"
            onClick={() => dismiss(toast.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
