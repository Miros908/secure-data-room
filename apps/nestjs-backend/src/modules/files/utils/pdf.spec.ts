import { isPdf } from './pdf';

describe('isPdf', () => {
  it('accepts a PDF magic header', () => {
    expect(isPdf(Buffer.from('%PDF-1.7'))).toBe(true);
  });

  it('rejects non-pdf bytes', () => {
    expect(isPdf(Buffer.from('hello'))).toBe(false);
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });

  it('rejects a truncated magic header', () => {
    expect(isPdf(Buffer.from('%PD'))).toBe(false);
  });

  it('rejects %PDF that is not at offset 0', () => {
    expect(isPdf(Buffer.from(' %PDF-1.7'))).toBe(false);
    expect(isPdf(Buffer.from('\ufeff%PDF-1.7'))).toBe(false);
  });
});
