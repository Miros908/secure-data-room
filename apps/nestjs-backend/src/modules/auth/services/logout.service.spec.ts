import { LogoutService } from './logout.service';
import type { AuthRepository } from '../auth.repository';

describe('LogoutService', () => {
  it('revokes the current session id', async () => {
    const authRepository = {
      revokeSession: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LogoutService(
      authRepository as unknown as AuthRepository,
    );

    await service.execute('session-1');

    expect(authRepository.revokeSession).toHaveBeenCalledWith('session-1');
  });
});
