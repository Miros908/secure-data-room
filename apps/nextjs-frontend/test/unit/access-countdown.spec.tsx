import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessCountdown } from '@/app/components/access-countdown';

describe('AccessCountdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onExpired once when the deadline is already past', () => {
    const onExpired = vi.fn();
    render(
      <AccessCountdown
        expiresAt="2026-08-16T11:00:00.000Z"
        onExpired={onExpired}
      />,
    );

    expect(screen.getByText('Access expired')).toBeInTheDocument();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('ticks to zero and then notifies', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z'));
    const onExpired = vi.fn();
    render(
      <AccessCountdown
        expiresAt="2026-08-16T12:00:02.000Z"
        onExpired={onExpired}
      />,
    );

    expect(screen.getByText(/Expires in/)).toBeInTheDocument();
    await act(async () => {
      vi.setSystemTime(new Date('2026-08-16T12:00:03.000Z'));
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Access expired')).toBeInTheDocument();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('resyncs remaining time when the tab becomes visible', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z'));
    render(
      <AccessCountdown expiresAt="2026-08-16T12:10:00.000Z" />,
    );

    expect(screen.getByText('Expires in 10m')).toBeInTheDocument();

    await act(async () => {
      vi.setSystemTime(new Date('2026-08-16T12:04:00.000Z'));
      window.dispatchEvent(new Event('focus'));
    });

    expect(screen.getByText('Expires in 6m')).toBeInTheDocument();
  });
});
