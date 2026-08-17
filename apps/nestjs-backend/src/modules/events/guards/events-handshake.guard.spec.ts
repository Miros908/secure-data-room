import {
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { EventsRepository } from '../events.repository';
import { EventsHandshakeGuard } from './events-handshake.guard';

function httpContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('EventsHandshakeGuard', () => {
  const eventsRepository = {
    findActivePublicLinkByTokenHash: jest.fn(),
  };
  const guard = new EventsHandshakeGuard(
    eventsRepository as unknown as EventsRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a missing session and token', async () => {
    await expect(
      guard.canActivate(httpContext({ query: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown public token', async () => {
    eventsRepository.findActivePublicLinkByTokenHash.mockResolvedValue(null);

    await expect(
      guard.canActivate(httpContext({ query: { token: 'a'.repeat(64) } })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an active public token without a session', async () => {
    eventsRepository.findActivePublicLinkByTokenHash.mockResolvedValue({
      id: 'link-1',
      dataRoomId: 'room-1',
    });

    await expect(
      guard.canActivate(httpContext({ query: { token: 'a'.repeat(64) } })),
    ).resolves.toBe(true);
  });

  it('allows a session without a token', async () => {
    await expect(
      guard.canActivate(
        httpContext({
          user: { id: 'user-1' },
          query: {},
        }),
      ),
    ).resolves.toBe(true);
    expect(
      eventsRepository.findActivePublicLinkByTokenHash,
    ).not.toHaveBeenCalled();
  });
});
