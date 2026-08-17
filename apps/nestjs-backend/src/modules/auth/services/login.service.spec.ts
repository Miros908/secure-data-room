import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { hashSessionToken } from '../utils/session-token';
import { LoginService } from './login.service';
import type { AuthRepository, AuthUserRecord } from '../auth.repository';
import type { AcceptInviteService } from '../../access/services/accept-invite.service';

const PASSWORD = 'password12';

describe('LoginService', () => {
  const authRepository = {
    findByEmail: jest.fn(),
    createSession: jest.fn(),
  };
  const acceptInviteService = {
    execute: jest.fn(),
  };
  const service = new LoginService(
    authRepository as unknown as AuthRepository,
    acceptInviteService as unknown as AcceptInviteService,
  );

  let passwordHash: string;

  const user: AuthUserRecord = {
    id: 'user-1',
    email: 'a@example.com',
    name: 'Ada',
    passwordHash: '',
    status: 'ACTIVE',
  };

  beforeAll(async () => {
    passwordHash = await hash(PASSWORD, 4);
    user.passwordHash = passwordHash;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    acceptInviteService.execute.mockResolvedValue({ accepted: 0 });
    authRepository.createSession.mockResolvedValue({ id: 'session-1' });
  });

  it('looks up the trimmed lowercase email', async () => {
    authRepository.findByEmail.mockResolvedValue(user);

    await service.execute({
      email: '  A@Example.COM  ',
      password: PASSWORD,
    });

    expect(authRepository.findByEmail).toHaveBeenCalledWith('a@example.com');
  });

  it('returns the same 401 when the user is missing', async () => {
    authRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.execute({ email: 'a@example.com', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepository.createSession).not.toHaveBeenCalled();
  });

  it('returns 401 when the user has no password hash', async () => {
    authRepository.findByEmail.mockResolvedValue({
      ...user,
      passwordHash: null,
    });

    await expect(
      service.execute({ email: 'a@example.com', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 401 for a wrong password, including a suspended account', async () => {
    authRepository.findByEmail.mockResolvedValue({
      ...user,
      status: 'SUSPENDED',
    });

    await expect(
      service.execute({ email: 'a@example.com', password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 403 after a matching password when the user is suspended', async () => {
    authRepository.findByEmail.mockResolvedValue({
      ...user,
      status: 'SUSPENDED',
    });

    await expect(
      service.execute({ email: 'a@example.com', password: PASSWORD }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(authRepository.createSession).not.toHaveBeenCalled();
  });

  it('creates a hashed session and accepts invites on success', async () => {
    authRepository.findByEmail.mockResolvedValue(user);

    const result = await service.execute({
      email: 'a@example.com',
      password: PASSWORD,
    });

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'a@example.com',
      name: 'Ada',
    });
    expect(result.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(authRepository.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
      tokenHash: hashSessionToken(result.rawToken),
      expiresAt: result.expiresAt,
    });
    expect(acceptInviteService.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'a@example.com',
    });
  });
});
