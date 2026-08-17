import { toAsciiFileName } from './ascii-file-name';

export function contentDispositionHeader(
  type: 'inline' | 'attachment',
  filename: string,
): string {
  const ascii = toAsciiFileName(filename);
  const encoded = encodeURIComponent(filename);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
