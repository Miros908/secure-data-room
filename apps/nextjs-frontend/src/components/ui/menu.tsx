'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';

export type MenuAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: 'danger';
  disabled?: boolean;
  onSelect: () => void;
};

const MENU_WIDTH = 208;

const MENU_SURFACE =
  'overflow-hidden rounded-lg border border-border bg-surface shadow-[0_16px_40px_rgb(17_29_50/0.14)] dark:shadow-[0_16px_40px_rgb(0_0_0/0.45)]';

type MenuListProps = {
  actions: MenuAction[];
  onClose: () => void;
  labelledBy?: string;
};

function MenuList({ actions, onClose, labelledBy }: MenuListProps) {
  const [active, setActive] = useState(0);
  const enabled = actions
    .map((action, index) => ({ action, index }))
    .filter((entry) => !entry.action.disabled);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((current) => {
          const position = enabled.findIndex((entry) => entry.index === current);
          const next = enabled[(position + 1) % enabled.length];
          return next?.index ?? current;
        });
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((current) => {
          const position = enabled.findIndex((entry) => entry.index === current);
          const next =
            enabled[(position - 1 + enabled.length) % enabled.length];
          return next?.index ?? current;
        });
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const current = actions[active];
        if (current && !current.disabled) {
          onClose();
          current.onSelect();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [actions, active, enabled, onClose]);

  return (
    <div role="menu" aria-labelledby={labelledBy} className="py-1">
      {actions.map((action, index) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          disabled={action.disabled}
          className={cx(
            'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:opacity-40',
            action.tone === 'danger' ? 'text-danger' : 'text-fg',
            index === active ? 'bg-surface-muted' : 'hover:bg-surface-muted',
          )}
          onMouseEnter={() => setActive(index)}
          onClick={() => {
            if (action.disabled) {
              return;
            }
            onClose();
            action.onSelect();
          }}
        >
          {action.icon ? (
            <span className={action.tone === 'danger' ? 'text-danger' : 'text-muted'}>
              {action.icon}
            </span>
          ) : null}
          {action.label}
        </button>
      ))}
    </div>
  );
}

type DropdownMenuProps = {
  label: string;
  actions: MenuAction[];
  align?: 'left' | 'right';
  trigger: ReactNode;
};

export function DropdownMenu({
  label,
  actions,
  align = 'right',
  trigger,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, ready: false });
  const triggerId = useId();

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const height = menuRef.current?.offsetHeight ?? 8 + actions.length * 40;
    let left = align === 'right' ? rect.right - MENU_WIDTH : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8);
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 4);
    }
    setCoords({ top, left, ready: true });
  }, [actions.length, align]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        id={triggerId}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) {
            const height = 8 + actions.length * 40;
            let left = align === 'right' ? rect.right - MENU_WIDTH : rect.left;
            left = Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8);
            let top = rect.bottom + 4;
            if (top + height > window.innerHeight - 8) {
              top = Math.max(8, rect.top - height - 4);
            }
            setCoords({ top, left, ready: true });
          }
          setOpen((current) => !current);
        }}
      >
        {trigger}
      </div>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={cx('fixed z-[70] w-52', MENU_SURFACE)}
              style={{
                top: coords.top,
                left: coords.left,
                visibility: coords.ready ? 'visible' : 'hidden',
              }}
            >
              <MenuList
                actions={actions}
                labelledBy={triggerId}
                onClose={() => setOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}

type ContextMenuProps = {
  x: number;
  y: number;
  actions: MenuAction[];
  onClose: () => void;
};

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? actions.length * 40 + 8;
    setCoords({
      left: Math.min(x, window.innerWidth - MENU_WIDTH - 8),
      top: Math.min(y, window.innerHeight - 16 - height),
    });
  }, [actions.length, x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={cx('fixed z-[70] w-52', MENU_SURFACE)}
      style={{ left: coords.left, top: coords.top }}
    >
      <MenuList actions={actions} onClose={onClose} />
    </div>,
    document.body,
  );
}
