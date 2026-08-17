import { describe, expect, it } from 'vitest';
import {
  formatPdfWatermark,
  publicWatermarkWho,
} from '@/app/components/pdf-watermark';

const NOW = new Date('2026-08-16T18:28:00.000Z');

describe('formatPdfWatermark', () => {
  it('puts the viewer email in the label', () => {
    expect(formatPdfWatermark('ivan@acme.com', NOW)).toContain('ivan@acme.com');
  });

  it('uses the public-link label when there is no session', () => {
    expect(formatPdfWatermark(null, NOW)).toContain(publicWatermarkWho());
    expect(formatPdfWatermark('  ', NOW)).toContain(publicWatermarkWho());
  });
});
