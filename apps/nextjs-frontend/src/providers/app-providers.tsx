import type { ReactNode } from 'react';
import { ToastViewport } from '@/components/toast-viewport';
import { LocaleProvider } from './locale-provider';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <LocaleProvider>
          {children}
          <ToastViewport />
        </LocaleProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
