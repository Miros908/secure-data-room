import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DeleteFolderResponse } from '@sdr/shared/folders';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { STORAGE_SERVICE } from '../../../infrastructure/storage/storage.tokens';
import { ResolveService } from '../../access/services/resolve.service';
import { ActivityRepository } from '../../activity/activity.repository';
import { EventsBroker } from '../../events/events.broker';
import { FoldersRepository } from '../folders.repository';

export type DeleteFolderInput = {
  id: string;
  userId: string;
};

@Injectable()
export class DeleteFolderService {
  constructor(
    private readonly foldersRepository: FoldersRepository,
    private readonly resolveService: ResolveService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly eventsBroker: EventsBroker,
    private readonly activityRepository: ActivityRepository,
  ) {}

  async execute(input: DeleteFolderInput): Promise<DeleteFolderResponse> {
    const { subject } = await this.resolveService.requireWritableSubject(
      'folder',
      input.id,
      input.userId,
    );
    const folder = await this.foldersRepository.findById(subject.id);

    if (!folder) {
      throw new NotFoundException('not_found');
    }

    const [counts, storageKeys] = await Promise.all([
      this.foldersRepository.countSubtree(folder),
      this.foldersRepository.listSubtreeStorageKeys(folder),
    ]);
    await this.foldersRepository.deleteById(folder.id, (tx) =>
      this.activityRepository
        .append(
          {
            type: ActivityEventType.FOLDER_DELETED,
            dataRoomId: folder.dataRoomId,
            actorUserId: input.userId,
            folderId: folder.id,
            resourceName: folder.name,
            metadata: {
              deletedFolders: counts.folders,
              deletedFiles: counts.files,
            },
          },
          tx,
        )
        .then(() => undefined),
    );
    this.eventsBroker.publishToDataRoom(folder.dataRoomId, {
      type: 'resource_gone',
      reason: 'deleted',
      dataRoomId: folder.dataRoomId,
      subject: { kind: 'folder', id: folder.id },
    });
    await Promise.all(
      storageKeys.map((key) => this.storage.delete(key).catch(() => undefined)),
    );

    return {
      ok: true,
      deletedFolders: counts.folders,
      deletedFiles: counts.files,
    };
  }
}
