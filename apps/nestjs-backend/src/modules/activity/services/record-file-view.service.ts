import { Injectable, NotFoundException } from '@nestjs/common';
import type { RecordFileViewResponse } from '@sdr/shared/activity';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import { AccessRepository } from '../../access/access.repository';
import { ResolveService } from '../../access/services/resolve.service';
import { toCoveringQuery } from '../../access/utils/resolve-access';
import { hashShareToken } from '../../access/utils/share-token';
import type { AccessSubject } from '../../access/access.types';
import { ActivityLivePublisher } from '../activity-live.publisher';
import { ActivityRepository } from '../activity.repository';

export type RecordFileViewInput = {
  id: string;
  userId?: string | null;
  token?: string | null;
};

@Injectable()
export class RecordFileViewService {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly activityLive: ActivityLivePublisher,
    private readonly resolveService: ResolveService,
    private readonly accessRepository: AccessRepository,
  ) {}

  async execute(input: RecordFileViewInput): Promise<RecordFileViewResponse> {
    const { subject } = await this.resolveService.requireReadableSubject(
      'file',
      input.id,
      { userId: input.userId, token: input.token },
    );
    const file = await this.activityRepository.findFileSnapshot(subject.id);

    if (!file) {
      throw new NotFoundException('not_found');
    }

    const publicShareLinkId = input.token
      ? await this.resolvePublicLinkId(input.token, subject)
      : null;

    const recorded = await this.activityRepository.append({
      type: ActivityEventType.FILE_VIEWED,
      dataRoomId: file.dataRoomId,
      actorUserId: input.userId ?? null,
      publicShareLinkId,
      fileId: file.id,
      folderId: file.folderId,
      resourceName: file.name,
      dedupe: true,
    });
    await this.activityLive.notifyOwner({
      recorded,
      dataRoomId: file.dataRoomId,
      actorUserId: input.userId,
    });

    return { ok: true };
  }

  private async resolvePublicLinkId(
    token: string,
    subject: AccessSubject,
  ): Promise<string | null> {
    const link = await this.accessRepository.findCoveringPublicLink({
      tokenHash: hashShareToken(token),
      ...toCoveringQuery(subject),
    });

    return link?.id ?? null;
  }
}
