import { createHash } from 'node:crypto';
import {
  createUploadTicket,
  parseUploadTicket,
  signaturesMatch,
  signUploadTicket,
  UPLOAD_TICKET_TTL_MS,
} from './upload-ticket';

describe('upload ticket', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const tokenHash = createHash('sha256').update('raw').digest('hex');

  it('round-trips a ticket bound to the session hash', () => {
    const now = 1_700_000_000_000;
    const issued = createUploadTicket(sessionId, tokenHash, now);
    const parsed = parseUploadTicket(issued.ticket);

    expect(parsed).toEqual({
      sessionId,
      expiresAtMs: now + UPLOAD_TICKET_TTL_MS,
      signature: signUploadTicket(
        sessionId,
        now + UPLOAD_TICKET_TTL_MS,
        tokenHash,
      ),
    });
    expect(issued.expiresAt.getTime()).toBe(now + UPLOAD_TICKET_TTL_MS);
  });

  it('rejects a ticket signed with a different hash', () => {
    const issued = createUploadTicket(sessionId, tokenHash);
    const parsed = parseUploadTicket(issued.ticket);
    expect(parsed).not.toBeNull();
    const other = signUploadTicket(
      parsed!.sessionId,
      parsed!.expiresAtMs,
      createHash('sha256').update('other').digest('hex'),
    );
    expect(signaturesMatch(parsed!.signature, other)).toBe(false);
  });

  it('returns null for a malformed ticket', () => {
    expect(parseUploadTicket('not-a-ticket')).toBeNull();
  });
});
