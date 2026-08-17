import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Folder, RenameFolderDto } from '@sdr/shared/folders';
import { rethrowNameConflict } from '../../../database/prisma-errors';
import { normalizeNodeName } from '../../../normalize-node-name';
import { ResolveService } from '../../access/services/resolve.service';
import { FoldersRepository } from '../folders.repository';
import { toFolderResponse } from '../utils/to-folder-response';

export type RenameFolderInput = RenameFolderDto & {
  id: string;
  userId: string;
};

@Injectable()
export class RenameFolderService {
  constructor(
    private readonly foldersRepository: FoldersRepository,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: RenameFolderInput): Promise<Folder> {
    const { subject } = await this.resolveService.requireWritableSubject(
      'folder',
      input.id,
      input.userId,
    );
    const folder = await this.foldersRepository.findById(subject.id);

    if (!folder) {
      throw new NotFoundException('not_found');
    }

    const name = normalizeNodeName(input.name);
    const taken = await this.foldersRepository.hasSiblingName({
      dataRoomId: folder.dataRoomId,
      parentId: folder.parentId,
      name,
      excludeId: folder.id,
    });

    if (taken) {
      throw new ConflictException('name_taken');
    }

    const renamed = await this.foldersRepository
      .rename(subject.id, name)
      .catch(rethrowNameConflict);
    return toFolderResponse(renamed);
  }
}
