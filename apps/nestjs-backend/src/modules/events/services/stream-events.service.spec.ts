import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { EventsBroker } from '../events.broker';
import type { EventsRepository } from '../events.repository';
import { StreamEventsService } from './stream-events.service';

const user = {
  id: 'user-1',
  email: 'a@example.test',
  name: 'A',
  sessionId: 'session-1',
};

describe('StreamEventsService', () => {
  const eventsRepository = {
    findActivePublicLinkByTokenHash: jest.fn(),
    findAccessibleDataRoomId: jest.fn(),
  };
  const service = new StreamEventsService(
    new EventsBroker(),
    eventsRepository as unknown as EventsRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a missing session and token', async () => {
    await expect(service.execute({ user: null })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown public token with 404', async () => {
    eventsRepository.findActivePublicLinkByTokenHash.mockResolvedValue(null);

    await expect(
      service.execute({ user: null, token: 'dead' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('emits a ping for a session and unsubscribes without leaking', async () => {
    const stream = await service.execute({ user });
    const events: MessageEvent[] = [];
    const sub = stream.subscribe((event) => events.push(event));

    expect(events[0]).toMatchObject({ type: 'ping' });
    sub.unsubscribe();
  });

  it('does not attach a guessed dataRoomId to the slot', async () => {
    const broker = new EventsBroker();
    const isolated = new StreamEventsService(
      broker,
      eventsRepository as unknown as EventsRepository,
    );
    eventsRepository.findAccessibleDataRoomId.mockResolvedValue(null);
    const subscribe = jest.spyOn(broker, 'subscribe');

    const stream = await isolated.execute({
      user,
      dataRoomId: '11111111-1111-4111-8111-111111111111',
    });
    const sub = stream.subscribe(() => undefined);

    expect(eventsRepository.findAccessibleDataRoomId).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(subscribe).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        publicLinkId: null,
        dataRoomId: null,
      },
      expect.any(Object),
    );
    sub.unsubscribe();
  });
});
