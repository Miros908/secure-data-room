import type { AccessRepository } from '../access.repository';
import { ShareByEmailService } from './share-by-email.service';
import type { InviteService } from './invite.service';

describe('ShareByEmailService', () => {
  it('wraps an invite as kind invite', async () => {
    const invite = {
      id: 'invite-1',
      email: 'b@example.com',
      role: 'viewer' as const,
      type: 'file' as const,
      subjectId: 'file-1',
      expiresAt: '2026-01-08T00:00:00.000Z',
      accessExpiresAt: null,
      token: 'ab'.repeat(32),
    };
    const inviteService = {
      execute: jest.fn().mockResolvedValue(invite),
    };
    const service = new ShareByEmailService(
      inviteService as unknown as InviteService,
    );
    const input = {
      email: 'b@example.com',
      role: 'viewer' as const,
      type: 'file' as const,
      id: 'file-1',
      grantedById: 'owner-1',
    };

    await expect(service.execute(input)).resolves.toEqual({
      kind: 'invite',
      ...invite,
    });
    expect(inviteService.execute).toHaveBeenCalledWith(input);
  });
});
