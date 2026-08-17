import { createHmac, timingSafeEqual } from 'node:crypto';

export const UPLOAD_TICKET_TTL_MS = 10 * 60 * 1000;
export const UPLOAD_TICKET_HEADER = 'x-upload-ticket';

export type UploadTicketParts = {
  sessionId: string;
  expiresAtMs: number;
  signature: string;
};

export function createUploadTicket(
  sessionId: string,
  tokenHash: string,
  now = Date.now(),
): { ticket: string; expiresAt: Date } {
  const expiresAtMs = now + UPLOAD_TICKET_TTL_MS;
  const signature = signUploadTicket(sessionId, expiresAtMs, tokenHash);
  return {
    ticket: `${sessionId}.${expiresAtMs}.${signature}`,
    expiresAt: new Date(expiresAtMs),
  };
}

export function parseUploadTicket(ticket: string): UploadTicketParts | null {
  const parts = ticket.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [sessionId, rawExpiry, signature] = parts;
  const expiresAtMs = Number(rawExpiry);
  if (!sessionId || !signature || !Number.isFinite(expiresAtMs)) {
    return null;
  }

  return { sessionId, expiresAtMs, signature };
}

export function signUploadTicket(
  sessionId: string,
  expiresAtMs: number,
  tokenHash: string,
): string {
  return createHmac('sha256', tokenHash)
    .update(`${sessionId}.${expiresAtMs}`)
    .digest('hex');
}

export function signaturesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
