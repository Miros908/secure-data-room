import { createHmac, timingSafeEqual } from 'node:crypto';

export const LOCAL_DOWNLOAD_PATH = '/storage/objects';

export type LocalDownloadDisposition = 'inline' | 'attachment';

export type LocalDownloadClaims = {
  key: string;
  filename: string;
  contentType: string;
  disposition: LocalDownloadDisposition;
  expiresAt: Date;
};

type SignInput = {
  publicBaseUrl: string;
  secret: string;
  key: string;
  filename: string;
  contentType: string;
  expiresInSeconds: number;
  disposition?: LocalDownloadDisposition;
};

export function signLocalDownloadUrl(input: SignInput): {
  url: string;
  expiresAt: Date;
} {
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
  const expires = String(Math.floor(expiresAt.getTime() / 1000));
  const disposition = input.disposition ?? 'inline';
  const sig = sign(
    input.secret,
    input.key,
    expires,
    input.filename,
    input.contentType,
    disposition,
  );
  const params = new URLSearchParams({
    key: input.key,
    expires,
    filename: input.filename,
    contentType: input.contentType,
    sig,
  });
  if (disposition === 'attachment') {
    params.set('disposition', 'attachment');
  }
  return {
    url: `${input.publicBaseUrl}${LOCAL_DOWNLOAD_PATH}?${params.toString()}`,
    expiresAt,
  };
}

export function verifyLocalDownloadUrl(
  secret: string,
  query: URLSearchParams,
): LocalDownloadClaims {
  const key = query.get('key') ?? '';
  const expires = query.get('expires') ?? '';
  const filename = query.get('filename') ?? 'file';
  const contentType = query.get('contentType') ?? 'application/octet-stream';
  const disposition: LocalDownloadDisposition =
    query.get('disposition') === 'attachment' ? 'attachment' : 'inline';
  const sig = query.get('sig') ?? '';

  const expected = sign(
    secret,
    key,
    expires,
    filename,
    contentType,
    disposition,
  );
  if (!safeEqual(sig, expected)) {
    throw new Error('invalid_signature');
  }

  const expiresAt = new Date(Number(expires) * 1000);
  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    throw new Error('expired');
  }

  return { key, filename, contentType, disposition, expiresAt };
}

function sign(
  secret: string,
  key: string,
  expires: string,
  filename: string,
  contentType: string,
  disposition: LocalDownloadDisposition,
): string {
  const payload =
    disposition === 'attachment'
      ? `${key}\n${expires}\n${filename}\n${contentType}\nattachment`
      : `${key}\n${expires}\n${filename}\n${contentType}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
