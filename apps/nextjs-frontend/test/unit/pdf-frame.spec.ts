import { describe, expect, it } from 'vitest';
import { pdfViewerSrc } from '@/app/components/pdf-frame';

describe('pdfViewerSrc', () => {
  it('hides the native toolbar on a signed URL', () => {
    expect(pdfViewerSrc('https://cdn.example/file.pdf?sig=1')).toBe(
      'https://cdn.example/file.pdf?sig=1#toolbar=0',
    );
  });

  it('keeps an existing fragment', () => {
    expect(pdfViewerSrc('about:blank#v1')).toBe('about:blank#v1&toolbar=0');
  });

  it('does not duplicate toolbar', () => {
    expect(pdfViewerSrc('https://cdn.example/file.pdf#toolbar=0')).toBe(
      'https://cdn.example/file.pdf#toolbar=0',
    );
  });
});
