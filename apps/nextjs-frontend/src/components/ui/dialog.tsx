'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/app/lib/i18n/use-t';
import { cx } from '@/lib/cx';
import { Button } from './button';
import { CloseIcon } from './icons';

type DialogProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  size?: 'md' | 'lg';
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  subtitle,
  onClose,
  closeDisabled = false,
  size = 'md',
  children,
}: DialogProps) {
  const t = useT();
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const firstField = panel?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
    );
    const first = firstField ?? focusable?.[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        if (dialogs[dialogs.length - 1] !== panel) {
          return;
        }
        event.stopPropagation();
        event.stopImmediatePropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panel) {
        return;
      }

      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => !node.hasAttribute('disabled') && node.tabIndex !== -1,
      );
      if (nodes.length === 0) {
        return;
      }

      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocus.current?.focus?.();
    };
  }, [closeDisabled, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button
        type="button"
        aria-label={t.common.close}
        className="absolute inset-0 bg-fg/45"
        disabled={closeDisabled}
        onClick={closeDisabled ? undefined : onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !closeDisabled) {
            event.stopPropagation();
            onClose();
          }
        }}
        className={cx(
          'relative z-10 my-auto w-full rounded-xl border border-border bg-surface p-5 shadow-[0_24px_64px_rgb(17_29_50/0.18)] sm:p-6 dark:shadow-[0_24px_64px_rgb(0_0_0/0.55)]',
          size === 'lg' ? 'max-w-xl' : 'max-w-md',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {subtitle ? (
              <p id={subtitleId} className="text-xs font-medium tracking-wide text-muted uppercase">
                {subtitle}
              </p>
            ) : null}
            <h2 id={titleId} className="truncate font-display text-xl font-semibold text-fg" title={title}>
              {title}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.common.close}
            disabled={closeDisabled}
            onClick={onClose}
          >
            <CloseIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
