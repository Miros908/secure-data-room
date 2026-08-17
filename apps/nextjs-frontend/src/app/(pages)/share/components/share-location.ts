import { resolvePublicLinkSchema } from '@sdr/shared/access';
import { z } from 'zod';

const uuidSchema = z.uuid();

export function parseUuid(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parseShareToken(value: string | null | undefined): string | undefined {
  const parsed = resolvePublicLinkSchema.safeParse({ token: value ?? '' });
  return parsed.success ? parsed.data.token : undefined;
}

export function shareHref(input: {
  token: string;
  folderId?: string;
  fileId?: string;
}): string {
  const params = new URLSearchParams();
  params.set('token', input.token);

  if (input.folderId) {
    params.set('folderId', input.folderId);
  }

  if (input.fileId) {
    params.set('fileId', input.fileId);
  }

  return `/share?${params.toString()}`;
}
