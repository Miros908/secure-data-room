import { describe, expect, it } from 'vitest';
import { getSiteUrl } from '@/lib/site';

describe('getSiteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    expect(
      getSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://deal-box.vercel.app',
        VERCEL_URL: 'preview.vercel.app',
      }).origin,
    ).toBe('https://deal-box.vercel.app');
  });

  it('uses the Vercel production domain in production', () => {
    expect(
      getSiteUrl({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'deal-box.vercel.app',
        VERCEL_URL: 'deal-box-git-main.vercel.app',
      }).origin,
    ).toBe('https://deal-box.vercel.app');
  });

  it('uses the deployment URL on Vercel previews', () => {
    expect(
      getSiteUrl({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'deal-box-git-seo.vercel.app',
      }).origin,
    ).toBe('https://deal-box-git-seo.vercel.app');
  });

  it('falls back to localhost in development', () => {
    expect(getSiteUrl({}).origin).toBe('http://localhost:3000');
  });
});
