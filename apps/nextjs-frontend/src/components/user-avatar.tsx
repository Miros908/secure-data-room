import { cx } from '@/lib/cx';

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  size?: 'sm' | 'md';
  className?: string;
};

export function UserAvatar({
  name,
  email,
  size = 'sm',
  className,
}: UserAvatarProps) {
  const source = name?.trim() || email?.trim() || '?';
  const initial = source.charAt(0).toUpperCase();

  return (
    <span
      aria-hidden
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white',
        size === 'md' ? 'h-10 w-10 text-base' : 'h-8 w-8 text-sm',
        className,
      )}
    >
      {initial}
    </span>
  );
}
