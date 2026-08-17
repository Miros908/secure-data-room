const DEFAULT_API_URL = 'http://localhost:4000';
const SAME_ORIGIN_API = '/backend';

// Direct `process.env.NEXT_PUBLIC_*` so Next inlines the value into the client bundle.
// Do not read `process.env.NEXT_PUBLIC_*` through a variable: Next will not replace
// that, and in `next dev` a runtime lookup can pick `.env` (port 4000) over Playwright's 4010.
const BUILT_API_URL = process.env.NEXT_PUBLIC_API_URL;
const BUILT_UPLOAD_API_URL = process.env.NEXT_PUBLIC_UPLOAD_API_URL;

export function apiBaseURL(env?: Partial<NodeJS.ProcessEnv>): string {
  const configured = stripSlash(
    env?.NEXT_PUBLIC_API_URL ?? BUILT_API_URL ?? DEFAULT_API_URL,
  );

  if (isRemoteBrowser() && !configured.startsWith('/')) {
    return SAME_ORIGIN_API;
  }

  return configured;
}

export function uploadApiBaseURL(env?: Partial<NodeJS.ProcessEnv>): string {
  const configured = env?.NEXT_PUBLIC_UPLOAD_API_URL ?? BUILT_UPLOAD_API_URL;
  if (configured) {
    return stripSlash(configured);
  }

  return apiBaseURL(env);
}

/** JSON идёт на same-origin `/backend`, байты файла — напрямую на API. */
export function usesCrossOriginUpload(
  env?: Partial<NodeJS.ProcessEnv>,
): boolean {
  return uploadApiBaseURL(env) !== apiBaseURL(env);
}

function isRemoteBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

function stripSlash(value: string): string {
  return value.replace(/\/$/, '');
}
