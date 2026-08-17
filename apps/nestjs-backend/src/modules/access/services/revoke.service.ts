import { Injectable, NotFoundException } from '@nestjs/common';
import type { RevokeAccessDto, RevokeAccessResponse } from '@sdr/shared/access';
import type { LiveEvent } from '@sdr/shared/events';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import { ActivityRepository } from '../../activity/activity.repository';
import { activityResourceName } from '../../activity/utils/resource-name';
import { EventsBroker } from '../../events/events.broker';
import { AccessRepository, type ShareTargetRecord } from '../access.repository';
import { toSubjectRef } from '../utils/subject-target';
import { ResolveService } from './resolve.service';

export type RevokeAccessInput = RevokeAccessDto & {
  actorId: string;
};

@Injectable()
export class RevokeService {
  constructor(
    private readonly accessRepository: AccessRepository,
    private readonly resolveService: ResolveService,
    private readonly eventsBroker: EventsBroker,
    private readonly activityRepository: ActivityRepository,
  ) {}

  async execute(input: RevokeAccessInput): Promise<RevokeAccessResponse> {
    const target = await this.findTarget(input.kind, input.id);

    if (!target) {
      throw new NotFoundException('not_found');
    }

    const { type, subjectId } = toSubjectRef(target);

    await this.resolveService.requireShareableSubject(
      input.actorId,
      type,
      subjectId,
    );

    const resourceName = await activityResourceName(
      this.accessRepository,
      target,
    );
    const revoked = await this.revoke(input.kind, input.id, (tx) =>
      this.activityRepository
        .append(
          {
            type: ActivityEventType.ACCESS_REVOKED,
            dataRoomId: target.dataRoomId,
            actorUserId: input.actorId,
            publicShareLinkId: input.kind === 'public_link' ? input.id : null,
            fileId: target.fileId,
            folderId: target.folderId,
            resourceName,
            metadata: { kind: input.kind },
          },
          tx,
        )
        .then(() => undefined),
    );

    if (!revoked) {
      throw new NotFoundException('not_found');
    }

    this.publish(input.kind, target);

    return { ok: true };
  }

  private findTarget(kind: RevokeAccessDto['kind'], id: string) {
    if (kind === 'grant') {
      return this.accessRepository.findActiveGrantById(id);
    }

    if (kind === 'invite') {
      return this.accessRepository.findPendingInviteById(id);
    }

    return this.accessRepository.findActivePublicLinkById(id);
  }

  private revoke(
    kind: RevokeAccessDto['kind'],
    id: string,
    after?: Parameters<AccessRepository['revokeGrant']>[1],
  ) {
    if (kind === 'grant') {
      return this.accessRepository.revokeGrant(id, after);
    }

    if (kind === 'invite') {
      return this.accessRepository.revokeInvite(id, after);
    }

    return this.accessRepository.revokePublicLink(id, after);
  }

  private publish(
    kind: RevokeAccessDto['kind'],
    target: ShareTargetRecord & { userId?: string },
  ): void {
    if (kind === 'invite') {
      return;
    }

    const { type, subjectId } = toSubjectRef(target);
    const event: LiveEvent = {
      type: 'access_invalidated',
      reason: 'revoked',
      dataRoomId: target.dataRoomId,
      target: { kind: type, id: subjectId },
    };

    if (kind === 'grant' && target.userId) {
      this.eventsBroker.publishToUser(target.userId, event);
      return;
    }

    if (kind === 'public_link') {
      this.eventsBroker.publishToPublicLink(target.id, event);
    }
  }
}
