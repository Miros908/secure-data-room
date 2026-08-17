import { vi } from 'vitest';

export const routerReplace = vi.fn();
export const routerPush = vi.fn();
export const routerBack = vi.fn();

let searchParams = new URLSearchParams();

export function getSearchParams() {
  return searchParams;
}

export function setSearchParams(
  init: ConstructorParameters<typeof URLSearchParams>[0] = '',
) {
  searchParams = new URLSearchParams(init);
}

export function resetNavigation() {
  routerReplace.mockReset();
  routerPush.mockReset();
  routerBack.mockReset();
  searchParams = new URLSearchParams();
}
