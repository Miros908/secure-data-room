import { escapeIlike, containsIlikePattern } from './like-pattern';

describe('escapeIlike', () => {
  it('escapes LIKE wildcards and backslash', () => {
    expect(escapeIlike('100%_off\\x')).toBe('100\\%\\_off\\\\x');
    expect(containsIlikePattern('term')).toBe('%term%');
    expect(containsIlikePattern('%')).toBe('%\\%%');
  });
});
