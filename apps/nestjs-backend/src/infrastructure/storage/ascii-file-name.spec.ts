import { toAsciiFileName } from './ascii-file-name';

describe('toAsciiFileName', () => {
  it('transliterates cyrillic for Content-Disposition filename=', () => {
    expect(toAsciiFileName('Договор.pdf')).toBe('Dogovor.pdf');
  });

  it('keeps ascii names', () => {
    expect(toAsciiFileName('report.pdf')).toBe('report.pdf');
  });

  it('replaces leftover non-ascii with underscores', () => {
    expect(toAsciiFileName('報告.pdf')).toBe('__.pdf');
  });
});
