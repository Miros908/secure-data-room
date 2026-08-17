import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FileDto, RenameFileDto } from '@sdr/shared/files';
import { rethrowNameConflict } from '../../../database/prisma-errors';
import { ResolveService } from '../../access/services/resolve.service';
import { FilesRepository } from '../files.repository';
import { sanitizeFileName } from '../utils/file-name';
import { toFileResponse } from '../utils/to-file-response';

export type RenameFileInput = RenameFileDto & {
  id: string;
  userId: string;
};

@Injectable()
export class RenameFileService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: RenameFileInput): Promise<FileDto> {
    const { subject } = await this.resolveService.requireWritableSubject(
      'file',
      input.id,
      input.userId,
    );
    const file = await this.filesRepository.findById(subject.id);

    if (!file) {
      throw new NotFoundException('not_found');
    }

    const name = sanitizeFileName(input.name);
    const taken = await this.filesRepository.hasSiblingName({
      dataRoomId: file.dataRoomId,
      folderId: file.folderId,
      name,
      excludeId: file.id,
    });

    if (taken) {
      throw new ConflictException('name_taken');
    }

    const renamed = await this.filesRepository
      .rename(file.id, name)
      .catch(rethrowNameConflict);
    return toFileResponse(renamed);
  }
}
