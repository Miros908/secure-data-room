import { Injectable, NotFoundException } from '@nestjs/common';
import type { FileVersionList } from '@sdr/shared/files';
import { ResolveService } from '../../access/services/resolve.service';
import { FilesRepository } from '../files.repository';

export type ListFileVersionsInput = {
  id: string;
  userId?: string | null;
  token?: string | null;
};

@Injectable()
export class ListFileVersionsService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: ListFileVersionsInput): Promise<FileVersionList> {
    await this.resolveService.requireReadableSubject('file', input.id, {
      userId: input.userId,
      token: input.token,
    });
    const file = await this.filesRepository.findById(input.id);

    if (!file) {
      throw new NotFoundException('not_found');
    }

    const versions = await this.filesRepository.listVersions(file.id);

    return {
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        sizeBytes: version.sizeBytes,
        createdAt: version.createdAt.toISOString(),
        uploadedByName: version.uploadedByName,
      })),
    };
  }
}
