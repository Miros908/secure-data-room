import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { FileDto, UploadFileFieldsDto } from '@sdr/shared/files';
import { isRetryableWriteConflict } from '../../../database/prisma-errors';
import { ResolveService } from '../../access/services/resolve.service';
import type { StorageConfig } from '../../../infrastructure/storage/storage.config';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import {
  STORAGE_CONFIG,
  STORAGE_SERVICE,
} from '../../../infrastructure/storage/storage.tokens';
import { MAX_FILE_BYTES, PDF_MIME_TYPE } from '../files.constants';
import { FilesRepository } from '../files.repository';
import type { FileRecord } from '../files.types';
import { sanitizeFileName } from '../utils/file-name';
import { isPdf } from '../utils/pdf';
import { buildFileStorageKey } from '../utils/storage-key';
import { toFileResponse } from '../utils/to-file-response';

const MAX_UPLOAD_ATTEMPTS = 8;

export type UploadFileInput = UploadFileFieldsDto & {
  userId: string;
  originalName: string;
  mimeType: string;
  body: Buffer;
};

@Injectable()
export class UploadFileService {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly resolveService: ResolveService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(STORAGE_CONFIG) private readonly storageConfig: StorageConfig,
  ) {}

  async execute(input: UploadFileInput): Promise<FileDto> {
    this.assertPdf(input.body);

    if (input.folderId) {
      const inRoom = await this.filesRepository.folderExistsInRoom(
        input.folderId,
        input.dataRoomId,
      );

      if (!inRoom) {
        throw new BadRequestException('invalid_parent');
      }
    }

    const name = sanitizeFileName(input.name ?? input.originalName);
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
      const existing = await this.filesRepository.findSibling({
        dataRoomId: input.dataRoomId,
        folderId: input.folderId ?? null,
        name,
      });

      if (existing) {
        await this.resolveService.requireWritableSubject(
          'file',
          existing.id,
          input.userId,
        );
        return this.addVersion(existing, input);
      }

      if (input.folderId) {
        await this.resolveService.requireWritableSubject(
          'folder',
          input.folderId,
          input.userId,
        );
      } else {
        await this.resolveService.requireWritableSubject(
          'data_room',
          input.dataRoomId,
          input.userId,
        );
      }

      try {
        return await this.createFile(name, input);
      } catch (error) {
        lastError = error;
        if (isRetryableWriteConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private async createFile(
    name: string,
    input: UploadFileInput,
  ): Promise<FileDto> {
    const id = randomUUID();
    const versionId = randomUUID();
    const storageKey = buildFileStorageKey(
      this.storageConfig.keyPrefix,
      input.dataRoomId,
      id,
      versionId,
    );

    await this.storage.put({
      key: storageKey,
      body: input.body,
      contentType: PDF_MIME_TYPE,
    });

    try {
      const file = await this.filesRepository.create({
        id,
        versionId,
        name,
        dataRoomId: input.dataRoomId,
        folderId: input.folderId ?? null,
        uploadedById: input.userId,
        storageKey,
        mimeType: PDF_MIME_TYPE,
        sizeBytes: input.body.length,
      });

      return toFileResponse(file, { isNewVersion: false });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  private async addVersion(
    file: FileRecord,
    input: UploadFileInput,
  ): Promise<FileDto> {
    const versionId = randomUUID();
    const storageKey = buildFileStorageKey(
      this.storageConfig.keyPrefix,
      file.dataRoomId,
      file.id,
      versionId,
    );

    await this.storage.put({
      key: storageKey,
      body: input.body,
      contentType: PDF_MIME_TYPE,
    });

    try {
      const updated = await this.insertVersionWithRetry({
        fileId: file.id,
        versionId,
        uploadedById: input.userId,
        storageKey,
        mimeType: PDF_MIME_TYPE,
        sizeBytes: input.body.length,
      });

      return toFileResponse(updated, { isNewVersion: true });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  private async insertVersionWithRetry(params: {
    fileId: string;
    versionId: string;
    uploadedById: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<FileRecord> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
      try {
        return await this.filesRepository.addVersion(params);
      } catch (error) {
        lastError = error;
        if (isRetryableWriteConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private assertPdf(body: Buffer): void {
    if (body.length === 0) {
      throw new BadRequestException('file_required');
    }

    if (body.length > MAX_FILE_BYTES) {
      throw new BadRequestException('file_too_large');
    }

    if (!isPdf(body)) {
      throw new BadRequestException('invalid_file_type');
    }
  }
}
