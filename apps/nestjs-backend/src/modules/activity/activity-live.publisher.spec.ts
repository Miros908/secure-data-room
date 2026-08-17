import type { EventsBroker } from '../events/events.broker';
import type { ActivityRepository } from './activity.repository';
import { ActivityLivePublisher } from './activity-live.publisher';

describe('ActivityLivePublisher', () => {
  const activityRepository = { findDataRoomOwnerId: jest.fn() };
  const eventsBroker = { publishToUser: jest.fn() };
  const publisher = new ActivityLivePublisher(
    activityRepository as unknown as ActivityRepository,
    eventsBroker as unknown as EventsBroker,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    activityRepository.findDataRoomOwnerId.mockResolvedValue('owner-1');
  });

  it('does nothing when append was deduped', async () => {
    await publisher.notifyOwner({
      recorded: null,
      dataRoomId: 'room-1',
      actorUserId: 'viewer-1',
    });
    expect(activityRepository.findDataRoomOwnerId).not.toHaveBeenCalled();
    expect(eventsBroker.publishToUser).not.toHaveBeenCalled();
  });

  it('does not notify the owner about their own action', async () => {
    await publisher.notifyOwner({
      recorded: { id: 'event-1' },
      dataRoomId: 'room-1',
      actorUserId: 'owner-1',
    });
    expect(eventsBroker.publishToUser).not.toHaveBeenCalled();
  });

  it('publishes activity_recorded to the owner', async () => {
    await publisher.notifyOwner({
      recorded: { id: 'event-1' },
      dataRoomId: 'room-1',
      actorUserId: 'viewer-1',
    });
    expect(eventsBroker.publishToUser).toHaveBeenCalledWith('owner-1', {
      type: 'activity_recorded',
      dataRoomId: 'room-1',
    });
  });
});
