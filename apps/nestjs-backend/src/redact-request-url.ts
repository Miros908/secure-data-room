export function redactRequestUrl(url: string): string {
  return url.replace(/([?&](?:token|sig|signature)=)[^&]*/gi, '$1[redacted]');
}
