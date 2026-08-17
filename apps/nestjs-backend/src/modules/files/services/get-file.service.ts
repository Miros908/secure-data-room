import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { FileDetail } from '@sdr/shared/files';
import { ResolveService } from '../../access/services/resolve.service';
import { toIsoOrNull } from '../../access/utils/access-expiry';
import { toVisibleRole } from '../../access/utils/resolve-access';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { STORAGE_SERVICE } from '../../../infrastructure/storage/storage.tokens';
import { FilesRepository } from '../files.repository';
import { downloadUrlOptions } from '../utils/download-url-options';
import { toFileResponse } from '../utils/to-file-response';

export type GetFileInput = {
  id: string;
  userId?: string | null;
  token?: string | null;
};

@Injectable()
export class GetFileService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly resolveService: ResolveService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async execute(input: GetFileInput): Promise<FileDetail> {
    const { subject, role, accessExpiresAt } =
      await this.resolveService.requireReadableSubject('file', input.id, {
        userId: input.userId,
        token: input.token,
      });
    const file = await this.filesRepository.findById(subject.id);

    if (!file) {
      throw new NotFoundException('not_found');
    }

    const download = await this.storage.getDownloadUrl(
      file.storageKey,
      downloadUrlOptions(file.name, file.mimeType, accessExpiresAt),
    );

    return {
      ...toFileResponse(file),
      currentVersionId: file.currentVersionId,
      role: toVisibleRole(role),
      accessExpiresAt: toIsoOrNull(accessExpiresAt),
      downloadUrl: download.url,
      downloadUrlExpiresAt: download.expiresAt.toISOString(),
    };
  }
}
