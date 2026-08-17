import '@testing-library/jest-dom/vitest';
import { randomUUID } from 'node:crypto';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { useLocaleStore } from '@/store/locale.store';
import {
  getSearchParams,
  resetNavigation,
  routerBack,
  routerPush,
  routerReplace,
} from './navigation';

if (typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  });
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: routerPush,
    prefetch: vi.fn(),
    back: routerBack,
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => getSearchParams(),
  usePathname: () => '/',
}));

afterEach(() => {
  cleanup();
  resetNavigation();
  localStorage.clear();
  useLocaleStore.setState({ locale: 'en' });
});
