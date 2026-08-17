import { Injectable, NotFoundException } from '@nestjs/common';
import type { ResolvePublicLinkResponse } from '@sdr/shared/access';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import { ActivityLivePublisher } from '../../activity/activity-live.publisher';
import { ActivityRepository } from '../../activity/activity.repository';
import { activityResourceName } from '../../activity/utils/resource-name';
import { AccessRepository } from '../access.repository';
import { toIsoOrNull } from '../utils/access-expiry';
import { hashShareToken } from '../utils/share-token';
import { toSubjectRef } from '../utils/subject-target';

export type ResolvePublicLinkInput = {
  token: string;
  userId?: string | null;
};

@Injectable()
export class ResolvePublicLinkService {
  constructor(
    private readonly accessRepository: AccessRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly activityLive: ActivityLivePublisher,
  ) {}

  async execute(
    input: ResolvePublicLinkInput,
  ): Promise<ResolvePublicLinkResponse> {
    const target = await this.accessRepository.findActivePublicLinkByTokenHash(
      hashShareToken(input.token),
    );

    if (!target) {
      throw new NotFoundException('not_found');
    }

    const resourceName = await activityResourceName(
      this.accessRepository,
      target,
    );
    const recorded = await this.activityRepository.append({
      type: ActivityEventType.LINK_OPENED,
      dataRoomId: target.dataRoomId,
      actorUserId: input.userId ?? null,
      publicShareLinkId: target.id,
      fileId: target.fileId,
      folderId: target.folderId,
      resourceName,
      dedupe: true,
    });
    await this.activityLive.notifyOwner({
      recorded,
      dataRoomId: target.dataRoomId,
      actorUserId: input.userId,
    });

    const { type, subjectId } = toSubjectRef(target);

    return {
      type,
      subjectId,
      dataRoomId: target.dataRoomId,
      accessExpiresAt: toIsoOrNull(target.expiresAt),
    };
  }
}
