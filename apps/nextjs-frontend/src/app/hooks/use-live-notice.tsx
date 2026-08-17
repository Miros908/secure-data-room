'use client';

import type { LiveEvent } from '@sdr/shared/events';
import { createContext, useContext, type ReactNode } from 'react';

export const LiveAccessContext = createContext<LiveEvent | null>(null);

export function useLiveNotice(): LiveEvent | null {
  return useContext(LiveAccessContext);
}

export function LiveAccessNoticeProvider({
  notice,
  children,
}: {
  notice: LiveEvent | null;
  children: ReactNode;
}) {
  return (
    <LiveAccessContext.Provider value={notice}>
      {children}
    </LiveAccessContext.Provider>
  );
}
