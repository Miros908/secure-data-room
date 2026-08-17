import { apiBaseURL } from '@/infrastructure/http/api-base-url';

export function liveEventsUrl(input: {
  token?: string;
  dataRoomId?: string;
}): string {
  const url = resolveApiUrl('events');

  if (input.token) {
    url.searchParams.set('token', input.token);
  }

  if (input.dataRoomId) {
    url.searchParams.set('dataRoomId', input.dataRoomId);
  }

  return url.toString();
}

function resolveApiUrl(path: string): URL {
  const base = apiBaseURL();
  const suffix = path.replace(/^\//, '');
  if (/^https?:\/\//i.test(base)) {
    return new URL(suffix, `${base}/`);
  }

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000';
  return new URL(`${base}/${suffix}`, origin);
}
