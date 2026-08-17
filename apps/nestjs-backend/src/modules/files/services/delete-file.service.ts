import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import { ResolveService } from '../../access/services/resolve.service';
import { ActivityRepository } from '../../activity/activity.repository';
import { EventsBroker } from '../../events/events.broker';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { STORAGE_SERVICE } from '../../../infrastructure/storage/storage.tokens';
import { FilesRepository } from '../files.repository';

export type DeleteFileInput = {
  id: string;
  userId: string;
};

@Injectable()
export class DeleteFileService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly resolveService: ResolveService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly eventsBroker: EventsBroker,
    private readonly activityRepository: ActivityRepository,
  ) {}

  async execute(input: DeleteFileInput): Promise<{ ok: true }> {
    const { subject } = await this.resolveService.requireWritableSubject(
      'file',
      input.id,
      input.userId,
    );
    const file = await this.filesRepository.findById(subject.id);

    if (!file) {
      throw new NotFoundException('not_found');
    }

    const storageKeys = await this.filesRepository.listStorageKeys(file.id);
    await this.filesRepository.deleteById(file.id, (tx) =>
      this.activityRepository
        .append(
          {
            type: ActivityEventType.FILE_DELETED,
            dataRoomId: file.dataRoomId,
            actorUserId: input.userId,
            fileId: file.id,
            folderId: file.folderId,
            resourceName: file.name,
          },
          tx,
        )
        .then(() => undefined),
    );
    this.eventsBroker.publishToDataRoom(file.dataRoomId, {
      type: 'resource_gone',
      reason: 'deleted',
      dataRoomId: file.dataRoomId,
      subject: { kind: 'file', id: file.id },
    });
    await Promise.all(
      storageKeys.map((key) => this.storage.delete(key).catch(() => undefined)),
    );

    return { ok: true };
  }
}
