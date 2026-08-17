import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RecordFileDownloadResponse } from '@sdr/shared/activity';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { STORAGE_SERVICE } from '../../../infrastructure/storage/storage.tokens';
import { AccessRepository } from '../../access/access.repository';
import { ResolveService } from '../../access/services/resolve.service';
import { toCoveringQuery } from '../../access/utils/resolve-access';
import { hashShareToken } from '../../access/utils/share-token';
import type { AccessSubject } from '../../access/access.types';
import { downloadUrlOptions } from '../../files/utils/download-url-options';
import { ActivityLivePublisher } from '../activity-live.publisher';
import { ActivityRepository } from '../activity.repository';

export type RecordFileDownloadInput = {
  id: string;
  userId?: string | null;
  token?: string | null;
  versionId?: string | null;
};

@Injectable()
export class RecordFileDownloadService {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly activityLive: ActivityLivePublisher,
    private readonly resolveService: ResolveService,
    private readonly accessRepository: AccessRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async execute(
    input: RecordFileDownloadInput,
  ): Promise<RecordFileDownloadResponse> {
    const { subject, accessExpiresAt } =
      await this.resolveService.requireReadableSubject('file', input.id, {
        userId: input.userId,
        token: input.token,
      });
    const file = await this.activityRepository.findFileSnapshot(subject.id);

    if (!file) {
      throw new NotFoundException('not_found');
    }

    const version = input.versionId
      ? await this.activityRepository.findFileVersionSnapshot(
          file.id,
          input.versionId,
        )
      : null;

    if (input.versionId && !version) {
      throw new NotFoundException('not_found');
    }

    const storageKey = version?.storageKey ?? file.storageKey;
    const mimeType = version?.mimeType ?? file.mimeType;
    const publicShareLinkId = input.token
      ? await this.resolvePublicLinkId(input.token, subject)
      : null;

    const recorded = await this.activityRepository.append({
      type: ActivityEventType.FILE_DOWNLOADED,
      dataRoomId: file.dataRoomId,
      actorUserId: input.userId ?? null,
      publicShareLinkId,
      fileId: file.id,
      folderId: file.folderId,
      resourceName: file.name,
      metadata: version ? { versionId: version.id } : null,
    });
    await this.activityLive.notifyOwner({
      recorded,
      dataRoomId: file.dataRoomId,
      actorUserId: input.userId,
    });

    const download = await this.storage.getDownloadUrl(
      storageKey,
      downloadUrlOptions(file.name, mimeType, accessExpiresAt, 'attachment'),
    );

    return {
      downloadUrl: download.url,
      downloadUrlExpiresAt: download.expiresAt.toISOString(),
    };
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
