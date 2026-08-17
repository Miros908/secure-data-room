import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GrantAccessDto, GrantAccessResponse } from '@sdr/shared/access';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import { ActivityRepository } from '../../activity/activity.repository';
import { activityResourceName } from '../../activity/utils/resource-name';
import { EventsBroker } from '../../events/events.broker';
import { AccessRepository, type AccessGrantRecord } from '../access.repository';
import { accessGrantedEvent } from '../utils/access-live-event';
import { parseAccessExpiresAt, toIsoOrNull } from '../utils/access-expiry';
import { assertNotCoveredByAncestor } from '../utils/covered-by-ancestor';
import { toSubjectRef } from '../utils/subject-target';
import { ResolveService } from './resolve.service';

export type GrantAccessInput = GrantAccessDto & {
  grantedById: string;
};

@Injectable()
export class GrantService {
  constructor(
    private readonly accessRepository: AccessRepository,
    private readonly resolveService: ResolveService,
    private readonly activityRepository: ActivityRepository,
    private readonly eventsBroker: EventsBroker,
  ) {}

  async execute(input: GrantAccessInput): Promise<GrantAccessResponse> {
    const { subject, target } =
      await this.resolveService.requireShareableSubject(
        input.grantedById,
        input.type,
        input.id,
      );

    if (input.userId === input.grantedById) {
      throw new BadRequestException('cannot_grant_self');
    }

    if (input.userId === subject.ownerId) {
      throw new BadRequestException('cannot_grant_owner');
    }

    const recipient = await this.accessRepository.findActiveUser(input.userId);

    if (!recipient) {
      throw new NotFoundException('not_found');
    }

    const existing = await this.accessRepository.findActiveGrant({
      userId: recipient.id,
      ...target,
    });

    if (existing) {
      throw new ConflictException('already_granted');
    }

    await assertNotCoveredByAncestor(this.accessRepository, {
      subject,
      userId: recipient.id,
      email: recipient.email,
    });

    const resourceName = await activityResourceName(
      this.accessRepository,
      target,
    );
    const grant = await this.accessRepository.createGrant(
      {
        userId: recipient.id,
        grantedById: input.grantedById,
        role: input.role,
        expiresAt: parseAccessExpiresAt(input.expiresAt),
        ...target,
      },
      (tx) =>
        this.activityRepository
          .append(
            {
              type: ActivityEventType.ACCESS_GRANTED,
              dataRoomId: target.dataRoomId,
              actorUserId: input.grantedById,
              fileId: target.fileId,
              folderId: target.folderId,
              resourceName,
              metadata: {
                kind: 'grant',
                role: input.role,
                email: recipient.email,
              },
            },
            tx,
          )
          .then(() => undefined),
    );

    const event = accessGrantedEvent(target);
    this.eventsBroker.publishToUser(recipient.id, event);
    this.eventsBroker.publishToDataRoom(target.dataRoomId, event);

    return toGrantResponse(grant);
  }
}

function toGrantResponse(grant: AccessGrantRecord): GrantAccessResponse {
  const { type, subjectId } = toSubjectRef(grant);

  return {
    id: grant.id,
    userId: grant.userId,
    role: grant.role,
    type,
    subjectId,
    expiresAt: toIsoOrNull(grant.expiresAt),
  };
}
