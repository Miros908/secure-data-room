import { hashSessionToken } from '../utils/session-token';
import { RegisterService } from './register.service';
import type { AuthRepository } from '../auth.repository';
import type { AcceptInviteService } from '../../access/services/accept-invite.service';
import { DEFAULT_DATA_ROOM_NAME } from '../../data-rooms/data-rooms.constants';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async () => 'hashed-password'),
}));

describe('RegisterService', () => {
  const authRepository = {
    findByEmail: jest.fn(),
    createRegisteredAccount: jest.fn(),
  };
  const acceptInviteService = {
    execute: jest.fn(),
  };
  const service = new RegisterService(
    authRepository as unknown as AuthRepository,
    acceptInviteService as unknown as AcceptInviteService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    acceptInviteService.execute.mockResolvedValue({ accepted: 0 });
  });

  it('does not create an account when the email is already registered', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'existing',
      email: 'a@example.com',
      name: 'Ada',
      passwordHash: 'x',
      status: 'ACTIVE',
    });

    const result = await service.execute({
      email: '  A@Example.COM ',
      name: '  Eve  ',
      password: 'password12',
    });

    expect(authRepository.createRegisteredAccount).not.toHaveBeenCalled();
    expect(acceptInviteService.execute).not.toHaveBeenCalled();
    expect(result.rawToken).toBeNull();
    expect(result.expiresAt).toBeNull();
    expect(result.user.email).toBe('a@example.com');
    expect(result.user.name).toBe('Eve');
    expect(result.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.user.id).not.toBe('existing');
  });

  it('creates the account, session and default room for a new email', async () => {
    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.createRegisteredAccount.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Ada',
    });

    const result = await service.execute({
      email: '  A@Example.COM ',
      name: '  Ada  ',
      password: 'password12',
    });

    expect(authRepository.createRegisteredAccount).toHaveBeenCalledWith({
      email: 'a@example.com',
      name: 'Ada',
      passwordHash: 'hashed-password',
      sessionTokenHash: hashSessionToken(result.rawToken as string),
      sessionExpiresAt: result.expiresAt,
      dataRoomName: DEFAULT_DATA_ROOM_NAME,
    });
    expect(acceptInviteService.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'a@example.com',
    });
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Ada',
    });
    expect(result.rawToken).toMatch(/^[0-9a-f]{64}$/);
  });
});
