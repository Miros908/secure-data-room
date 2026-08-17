'use client';

import { useMemo, useState } from 'react';
import { getMessages, getLocale } from '@/app/lib/i18n/get-messages';
import { LOCALE_META } from '@/app/lib/i18n/locale';
import { useLocale } from '@/app/lib/i18n/use-t';

export function publicWatermarkWho(): string {
  return getMessages().watermark.publicWho;
}

const TILE_COUNT = 48;

export function formatPdfWatermark(
  email: string | null | undefined,
  now: Date = new Date(),
  locale = getLocale(),
): string {
  const who = email?.trim() ? email.trim() : publicWatermarkWho();
  const stamp = new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return `${who} · ${stamp}`;
}

type PdfWatermarkProps = {
  email?: string | null;
  ready?: boolean;
};

export function PdfWatermark({ email, ready = true }: PdfWatermarkProps) {
  const locale = useLocale();
  const [viewedAt] = useState(() => new Date());

  const label = useMemo(
    () => formatPdfWatermark(email, viewedAt, locale),
    [email, viewedAt, locale],
  );

  if (!ready) {
    return null;
  }

  return (
    <div
      aria-hidden
      data-pdf-watermark=""
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none"
    >
      <div className="absolute top-1/2 left-1/2 flex w-[240%] origin-center -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] flex-wrap content-center justify-center gap-x-16 gap-y-16">
        {Array.from({ length: TILE_COUNT }, (_, index) => (
          <span
            key={index}
            className="shrink-0 whitespace-nowrap text-[13px] font-semibold tracking-[0.16em] text-navy/25"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
