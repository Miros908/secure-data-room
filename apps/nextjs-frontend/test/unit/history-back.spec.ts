import { describe, expect, it, vi } from 'vitest';
import { goBackOrReplace } from '@/app/lib/history-back';

describe('goBackOrReplace', () => {
  it('goes back when the tab has history', () => {
    const router = { back: vi.fn(), replace: vi.fn() };
    goBackOrReplace(router, '/drive', 2);
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces when this is the only history entry', () => {
    const router = { back: vi.fn(), replace: vi.fn() };
    goBackOrReplace(router, '/drive', 1);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/drive');
  });
});
