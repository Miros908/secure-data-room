import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PRISMA_INTERACTIVE_TRANSACTION,
  type PrismaTx,
} from '../../database/prisma-transaction';
import type { FileRecord, FileVersionRecord } from './files.types';

const FILE_SELECT = {
  id: true,
  name: true,
  data_room_id: true,
  folder_id: true,
  mime_type: true,
  size_bytes: true,
  created_at: true,
  current_version: {
    select: {
      id: true,
      storage_key: true,
      version_number: true,
    },
  },
  _count: { select: { versions: true } },
} as const;

@Injectable()
export class FilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<FileRecord | null> {
    const file = await this.prisma.files.findUnique({
      where: { id },
      select: FILE_SELECT,
    });

    return file ? toFileRecord(file) : null;
  }

  async folderExistsInRoom(
    folderId: string,
    dataRoomId: string,
  ): Promise<boolean> {
    const folder = await this.prisma.folders.findFirst({
      where: { id: folderId, data_room_id: dataRoomId },
      select: { id: true },
    });

    return folder !== null;
  }

  async hasSiblingName(params: {
    dataRoomId: string;
    folderId: string | null;
    name: string;
    excludeId?: string;
  }): Promise<boolean> {
    const sibling = await this.findSibling(params);
    return sibling !== null;
  }

  async findSibling(params: {
    dataRoomId: string;
    folderId: string | null;
    name: string;
    excludeId?: string;
  }): Promise<FileRecord | null> {
    const file = await this.prisma.files.findFirst({
      where: {
        data_room_id: params.dataRoomId,
        folder_id: params.folderId,
        name: params.name,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
      select: FILE_SELECT,
    });

    return file ? toFileRecord(file) : null;
  }

  async create(params: {
    id: string;
    versionId: string;
    name: string;
    dataRoomId: string;
    folderId: string | null;
    uploadedById: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<FileRecord> {
    return this.prisma.$transaction(async (tx) => {
      await tx.files.create({
        data: {
          id: params.id,
          name: params.name,
          data_room_id: params.dataRoomId,
          folder_id: params.folderId,
          uploaded_by_id: params.uploadedById,
          mime_type: params.mimeType,
          size_bytes: BigInt(params.sizeBytes),
        },
      });
      await tx.file_versions.create({
        data: {
          id: params.versionId,
          file_id: params.id,
          version_number: 1,
          storage_key: params.storageKey,
          mime_type: params.mimeType,
          size_bytes: BigInt(params.sizeBytes),
          uploaded_by_id: params.uploadedById,
        },
      });
      const file = await tx.files.update({
        where: { id: params.id },
        data: { current_version_id: params.versionId },
        select: FILE_SELECT,
      });

      return toFileRecord(file);
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }

  async addVersion(params: {
    fileId: string;
    versionId: string;
    uploadedById: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<FileRecord> {
    return this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.file_versions.aggregate({
        where: { file_id: params.fileId },
        _max: { version_number: true },
      });
      const versionNumber = (aggregate._max.version_number ?? 0) + 1;
      await tx.file_versions.create({
        data: {
          id: params.versionId,
          file_id: params.fileId,
          version_number: versionNumber,
          storage_key: params.storageKey,
          mime_type: params.mimeType,
          size_bytes: BigInt(params.sizeBytes),
          uploaded_by_id: params.uploadedById,
        },
      });
      const file = await tx.files.update({
        where: { id: params.fileId },
        data: {
          current_version_id: params.versionId,
          mime_type: params.mimeType,
          size_bytes: BigInt(params.sizeBytes),
        },
        select: FILE_SELECT,
      });

      return toFileRecord(file);
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }

  async findVersion(
    fileId: string,
    versionId: string,
  ): Promise<FileVersionRecord | null> {
    const version = await this.prisma.file_versions.findFirst({
      where: { id: versionId, file_id: fileId },
      select: {
        id: true,
        file_id: true,
        version_number: true,
        storage_key: true,
        mime_type: true,
        size_bytes: true,
        created_at: true,
        uploaded_by: { select: { name: true } },
      },
    });

    return version ? toVersionRecord(version) : null;
  }

  async listVersions(fileId: string): Promise<FileVersionRecord[]> {
    const versions = await this.prisma.file_versions.findMany({
      where: { file_id: fileId },
      select: {
        id: true,
        file_id: true,
        version_number: true,
        storage_key: true,
        mime_type: true,
        size_bytes: true,
        created_at: true,
        uploaded_by: { select: { name: true } },
      },
      orderBy: [{ version_number: 'desc' }, { id: 'desc' }],
    });

    return versions.map(toVersionRecord);
  }

  async listStorageKeys(fileId: string): Promise<string[]> {
    const versions = await this.prisma.file_versions.findMany({
      where: { file_id: fileId },
      select: { storage_key: true },
    });

    return versions.map((version) => version.storage_key);
  }

  async rename(id: string, name: string): Promise<FileRecord> {
    const file = await this.prisma.files.update({
      where: { id },
      data: { name },
      select: FILE_SELECT,
    });

    return toFileRecord(file);
  }

  async move(params: {
    id: string;
    folderId: string | null;
  }): Promise<FileRecord> {
    const file = await this.prisma.files.update({
      where: { id: params.id },
      data: { folder_id: params.folderId },
      select: FILE_SELECT,
    });

    return toFileRecord(file);
  }

  async deleteById(
    id: string,
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.files.update({
        where: { id },
        data: { current_version_id: null },
      });
      await tx.files.delete({ where: { id } });
      await after?.(tx);
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }
}

type FileRow = {
  id: string;
  name: string;
  data_room_id: string;
  folder_id: string | null;
  mime_type: string;
  size_bytes: bigint;
  created_at: Date;
  current_version: {
    id: string;
    storage_key: string;
    version_number: number;
  } | null;
  _count: { versions: number };
};

function toFileRecord(file: FileRow): FileRecord {
  if (!file.current_version) {
    throw new Error('file_current_version_missing');
  }

  return {
    id: file.id,
    name: file.name,
    dataRoomId: file.data_room_id,
    folderId: file.folder_id,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes),
    storageKey: file.current_version.storage_key,
    currentVersionId: file.current_version.id,
    versionNumber: file.current_version.version_number,
    versionCount: file._count.versions,
    createdAt: file.created_at,
  };
}

function toVersionRecord(version: {
  id: string;
  file_id: string;
  version_number: number;
  storage_key: string;
  mime_type: string;
  size_bytes: bigint;
  created_at: Date;
  uploaded_by: { name: string };
}): FileVersionRecord {
  return {
    id: version.id,
    fileId: version.file_id,
    versionNumber: version.version_number,
    storageKey: version.storage_key,
    mimeType: version.mime_type,
    sizeBytes: Number(version.size_bytes),
    uploadedByName: version.uploaded_by.name,
    createdAt: version.created_at,
  };
}
