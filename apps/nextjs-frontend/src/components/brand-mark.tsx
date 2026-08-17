import Link from 'next/link';
import { cx } from '@/lib/cx';

type BrandMarkProps = {
  href?: string;
  compact?: boolean;
  inverse?: boolean;
  className?: string;
};

export function BrandMark({
  href = '/',
  compact = false,
  inverse = false,
  className,
}: BrandMarkProps) {
  const mark = (
    <span className={cx('flex min-w-0 items-center gap-2', className)}>
      {compact ? (
        <>
          <MarkImage />
          <span className="sr-only">DealBox</span>
        </>
      ) : inverse ? (
        <Wordmark inverse />
      ) : (
        <>
          <img
            src="/dealbox-logo.svg"
            alt="DealBox"
            draggable={false}
            className="h-8 w-auto max-w-38 shrink-0 object-contain object-left dark:hidden sm:max-w-none"
          />
          <span className="hidden dark:contents">
            <Wordmark />
          </span>
        </>
      )}
    </span>
  );

  if (!href) {
    return mark;
  }

  return (
    <Link href={href} className="min-w-0 shrink-0 rounded-md outline-offset-4">
      {mark}
    </Link>
  );
}

function MarkImage() {
  return (
    <img
      src="/dealbox-mark.svg"
      alt=""
      draggable={false}
      className="h-8 w-8 shrink-0 object-contain"
    />
  );
}

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <MarkImage />
      <span
        aria-label="DealBox"
        className="truncate text-[1.2rem] leading-none font-bold tracking-tight"
      >
        <span className={inverse ? 'text-white' : 'text-navy dark:text-fg'} aria-hidden>
          Deal
        </span>
        <span className="text-accent" aria-hidden>
          Box
        </span>
      </span>
    </span>
  );
}
