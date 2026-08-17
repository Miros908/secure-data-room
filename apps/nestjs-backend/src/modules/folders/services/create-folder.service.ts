import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { CreateFolderDto, Folder } from '@sdr/shared/folders';
import { rethrowNameConflict } from '../../../database/prisma-errors';
import { normalizeNodeName } from '../../../normalize-node-name';
import { ResolveService } from '../../access/services/resolve.service';
import { parseFolderPath } from '../../access/utils/folder-path';
import { MAX_FOLDER_DEPTH, MAX_FOLDER_PATH_LENGTH } from '../folders.constants';
import { FoldersRepository } from '../folders.repository';
import { buildFolderPath } from '../utils/folder-path';
import { toFolderResponse } from '../utils/to-folder-response';

export type CreateFolderInput = CreateFolderDto & {
  userId: string;
};

@Injectable()
export class CreateFolderService {
  constructor(
    private readonly foldersRepository: FoldersRepository,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: CreateFolderInput): Promise<Folder> {
    const name = normalizeNodeName(input.name);
    const parent = await this.resolveParent(input);
    const taken = await this.foldersRepository.hasSiblingName({
      dataRoomId: parent.dataRoomId,
      parentId: parent.parentId,
      name,
    });

    if (taken) {
      throw new ConflictException('name_taken');
    }

    const id = randomUUID();
    const path = buildFolderPath(parent.parentPath, id);

    if (path.length > MAX_FOLDER_PATH_LENGTH) {
      throw new BadRequestException('folder_too_deep');
    }

    const folder = await this.foldersRepository
      .create({
        id,
        name,
        dataRoomId: parent.dataRoomId,
        parentId: parent.parentId,
        path,
      })
      .catch(rethrowNameConflict);

    return toFolderResponse(folder);
  }

  private async resolveParent(input: CreateFolderInput): Promise<{
    dataRoomId: string;
    parentId: string | null;
    parentPath: string | null;
  }> {
    if (input.parentId) {
      const { subject } = await this.resolveService.requireWritableSubject(
        'folder',
        input.parentId,
        input.userId,
      );

      if (input.dataRoomId && input.dataRoomId !== subject.dataRoomId) {
        throw new BadRequestException('invalid_parent');
      }

      const depth = parseFolderPath(subject.folderPath).length;

      if (depth >= MAX_FOLDER_DEPTH) {
        throw new BadRequestException('folder_too_deep');
      }

      return {
        dataRoomId: subject.dataRoomId,
        parentId: subject.id,
        parentPath: subject.folderPath,
      };
    }

    if (!input.dataRoomId) {
      throw new BadRequestException('parent_or_data_room_required');
    }

    const { subject } = await this.resolveService.requireWritableSubject(
      'data_room',
      input.dataRoomId,
      input.userId,
    );

    return {
      dataRoomId: subject.id,
      parentId: null,
      parentPath: null,
    };
  }
}
