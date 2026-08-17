'use client';

import { useEffect, useRef, useState } from 'react';
import { getMessages } from '@/app/lib/i18n/get-messages';
import { useT } from '@/app/lib/i18n/use-t';
import { cx } from '@/lib/cx';

type AccessCountdownProps = {
  expiresAt: string;
  onExpired?: () => void;
  className?: string;
};

export function AccessCountdown({
  expiresAt,
  onExpired,
  className,
}: AccessCountdownProps) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(false);
  const onExpiredRef = useRef(onExpired);
  const remainingMs = new Date(expiresAt).getTime() - now;
  const expired = remainingMs <= 0;

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    const sync = () => setNow(Date.now());
    sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
    };
  }, [expiresAt]);

  useEffect(() => {
    if (expired) {
      if (!notified.current) {
        notified.current = true;
        onExpiredRef.current?.();
      }
      return;
    }

    notified.current = false;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [expired]);

  return (
    <p aria-live="polite" className={cx('text-sm text-muted', className)}>
      {expired
        ? t.countdown.expired
        : t.countdown.expiresIn(formatRemaining(remainingMs))}
    </p>
  );
}

export function formatRemaining(ms: number): string {
  const t = getMessages().countdown;
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? t.daysHours(days, hours) : t.days(days);
  }

  if (hours > 0) {
    return minutes > 0 ? t.hoursMinutes(hours, minutes) : t.hours(hours);
  }

  if (minutes >= 5) {
    return t.minutes(minutes);
  }

  if (minutes > 0) {
    return t.minutesSeconds(minutes, seconds);
  }

  return t.seconds(seconds);
}

export function formatRemainingShort(expiresAt: string, now = Date.now()): string | null {
  const t = getMessages().countdown;
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms)) {
    return null;
  }

  if (ms <= 0) {
    return t.expiredShort;
  }

  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) {
    return t.leftMinutes(minutes);
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return t.leftHours(hours);
  }

  return t.leftDays(Math.round(hours / 24));
}
