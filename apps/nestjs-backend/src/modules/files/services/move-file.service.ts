import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FileDto, MoveFileDto } from '@sdr/shared/files';
import { rethrowNameConflict } from '../../../database/prisma-errors';
import { ResolveService } from '../../access/services/resolve.service';
import { FilesRepository } from '../files.repository';
import { toFileResponse } from '../utils/to-file-response';

export type MoveFileInput = MoveFileDto & {
  id: string;
  userId: string;
};

@Injectable()
export class MoveFileService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: MoveFileInput): Promise<FileDto> {
    const { subject } = await this.resolveService.requireWritableSubject(
      'file',
      input.id,
      input.userId,
    );
    const file = await this.filesRepository.findById(subject.id);

    if (!file) {
      throw new NotFoundException('not_found');
    }

    if (input.folderId === file.folderId) {
      return toFileResponse(file);
    }

    if (input.folderId) {
      const { subject: folder } =
        await this.resolveService.requireWritableSubject(
          'folder',
          input.folderId,
          input.userId,
        );

      if (folder.dataRoomId !== file.dataRoomId) {
        throw new BadRequestException('invalid_destination');
      }
    } else {
      await this.resolveService.requireWritableSubject(
        'data_room',
        file.dataRoomId,
        input.userId,
      );
    }

    const taken = await this.filesRepository.hasSiblingName({
      dataRoomId: file.dataRoomId,
      folderId: input.folderId,
      name: file.name,
    });

    if (taken) {
      throw new ConflictException('name_taken');
    }

    const moved = await this.filesRepository
      .move({
        id: file.id,
        folderId: input.folderId,
      })
      .catch(rethrowNameConflict);

    return toFileResponse(moved);
  }
}
