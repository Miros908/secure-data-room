import { ConflictException, Injectable } from '@nestjs/common';
import type {
  CreatePublicLinkDto,
  CreatePublicLinkResponse,
} from '@sdr/shared/access';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import { ActivityRepository } from '../../activity/activity.repository';
import { activityResourceName } from '../../activity/utils/resource-name';
import { EventsBroker } from '../../events/events.broker';
import { AccessRepository } from '../access.repository';
import { accessGrantedEvent } from '../utils/access-live-event';
import { parseAccessExpiresAt } from '../utils/access-expiry';
import { generateShareToken, hashShareToken } from '../utils/share-token';
import { toSubjectRef } from '../utils/subject-target';
import { ResolveService } from './resolve.service';

export type CreatePublicLinkInput = CreatePublicLinkDto & {
  createdById: string;
};

@Injectable()
export class CreatePublicLinkService {
  constructor(
    private readonly accessRepository: AccessRepository,
    private readonly resolveService: ResolveService,
    private readonly activityRepository: ActivityRepository,
    private readonly eventsBroker: EventsBroker,
  ) {}

  async execute(
    input: CreatePublicLinkInput,
  ): Promise<CreatePublicLinkResponse> {
    const { target } = await this.resolveService.requireShareableSubject(
      input.createdById,
      input.type,
      input.id,
    );

    const expiresAt = parseAccessExpiresAt(input.expiresAt);

    const existing = await this.accessRepository.findActivePublicLink(target);

    if (existing) {
      throw new ConflictException('already_shared');
    }

    const token = generateShareToken();
    const resourceName = await activityResourceName(
      this.accessRepository,
      target,
    );
    const link = await this.accessRepository.createPublicLink(
      {
        createdById: input.createdById,
        tokenHash: hashShareToken(token),
        expiresAt,
        ...target,
      },
      (tx, record) =>
        this.activityRepository
          .append(
            {
              type: ActivityEventType.ACCESS_GRANTED,
              dataRoomId: target.dataRoomId,
              actorUserId: input.createdById,
              publicShareLinkId: record.id,
              fileId: target.fileId,
              folderId: target.folderId,
              resourceName,
              metadata: { kind: 'public_link' },
            },
            tx,
          )
          .then(() => undefined),
    );

    this.eventsBroker.publishToDataRoom(
      target.dataRoomId,
      accessGrantedEvent(target),
    );

    const { type, subjectId } = toSubjectRef(link);

    return {
      id: link.id,
      type,
      subjectId,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      token,
    };
  }
}
