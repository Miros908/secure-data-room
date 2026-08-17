import { DEFAULT_FILE_NAME } from '../files.constants';

export function decodeMultipartFileName(raw: string): string {
  const looksLikeLatin1Mojibake = [...raw].some((char) => {
    const code = char.charCodeAt(0);
    return code >= 128 && code <= 255;
  });

  if (!looksLikeLatin1Mojibake) {
    return raw;
  }

  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  if (decoded.includes('\uFFFD')) {
    return raw;
  }

  return decoded;
}

export function sanitizeFileName(raw: string | undefined): string {
  const decoded = decodeMultipartFileName(raw ?? '');
  const base = decoded.replaceAll('\\', '/').split('/').pop() ?? '';
  const cleaned = [...base]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && !'<>:"|?*'.includes(char);
    })
    .join('')
    .trim()
    .normalize('NFC');
  const withExt = cleaned.toLowerCase().endsWith('.pdf')
    ? cleaned
    : cleaned.length > 0
      ? `${cleaned}.pdf`
      : DEFAULT_FILE_NAME;
  const trimmed = withExt.slice(0, 255);

  if (trimmed === '.pdf' || trimmed === '..pdf') {
    return DEFAULT_FILE_NAME;
  }

  return trimmed;
}
