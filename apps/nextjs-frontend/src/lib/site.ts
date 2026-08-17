export const SITE_NAME = 'DealBox';

export const SITE_TITLE = 'DealBox — Share files with people you choose';

export const SITE_DESCRIPTION =
  'Upload files, share a link or with a person, and revoke access anytime.';

export function getSiteUrl(env: Partial<NodeJS.ProcessEnv> = process.env): URL {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return new URL(explicit);
  }

  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  if (env.VERCEL_URL) {
    return new URL(`https://${env.VERCEL_URL}`);
  }

  return new URL('http://localhost:3000');
}
