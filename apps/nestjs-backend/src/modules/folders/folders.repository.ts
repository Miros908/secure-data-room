import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PRISMA_INTERACTIVE_TRANSACTION,
  type PrismaTx,
} from '../../database/prisma-transaction';
import type {
  FileChildRecord,
  FolderChildRecord,
  FolderRecord,
} from './folders.types';

const FOLDER_SELECT = {
  id: true,
  name: true,
  parent_id: true,
  data_room_id: true,
  path: true,
  created_at: true,
  data_room: { select: { owner_id: true } },
} as const;

@Injectable()
export class FoldersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<FolderRecord | null> {
    const folder = await this.prisma.folders.findUnique({
      where: { id },
      select: FOLDER_SELECT,
    });

    return folder ? toFolderRecord(folder) : null;
  }

  async findManyByIds(ids: string[]): Promise<FolderRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const folders = await this.prisma.folders.findMany({
      where: { id: { in: ids } },
      select: FOLDER_SELECT,
    });

    return folders.map(toFolderRecord);
  }

  async hasSiblingName(params: {
    dataRoomId: string;
    parentId: string | null;
    name: string;
    excludeId?: string;
  }): Promise<boolean> {
    const folder = await this.prisma.folders.findFirst({
      where: {
        data_room_id: params.dataRoomId,
        parent_id: params.parentId,
        name: params.name,
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
      select: { id: true },
    });

    return folder !== null;
  }

  async listChildFolders(params: {
    dataRoomId: string;
    parentId: string | null;
  }): Promise<FolderChildRecord[]> {
    const folders = await this.prisma.folders.findMany({
      where: {
        data_room_id: params.dataRoomId,
        parent_id: params.parentId,
      },
      select: { id: true, name: true, created_at: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      createdAt: folder.created_at,
    }));
  }

  async listChildFiles(params: {
    dataRoomId: string;
    folderId: string | null;
  }): Promise<FileChildRecord[]> {
    const files = await this.prisma.files.findMany({
      where: {
        data_room_id: params.dataRoomId,
        folder_id: params.folderId,
      },
      select: {
        id: true,
        name: true,
        mime_type: true,
        size_bytes: true,
        created_at: true,
        _count: { select: { versions: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return files.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mime_type,
      sizeBytes: Number(file.size_bytes),
      versionCount: file._count.versions,
      createdAt: file.created_at,
    }));
  }

  async create(params: {
    id: string;
    name: string;
    dataRoomId: string;
    parentId: string | null;
    path: string;
  }): Promise<FolderRecord> {
    const folder = await this.prisma.folders.create({
      data: {
        id: params.id,
        name: params.name,
        data_room_id: params.dataRoomId,
        parent_id: params.parentId,
        path: params.path,
      },
      select: FOLDER_SELECT,
    });

    return toFolderRecord(folder);
  }

  async rename(id: string, name: string): Promise<FolderRecord> {
    const folder = await this.prisma.folders.update({
      where: { id },
      data: { name },
      select: FOLDER_SELECT,
    });

    return toFolderRecord(folder);
  }

  async countSubtree(folder: FolderRecord): Promise<{
    folders: number;
    files: number;
  }> {
    const [folders, files] = await Promise.all([
      this.prisma.folders.count({
        where: {
          data_room_id: folder.dataRoomId,
          path: { startsWith: folder.path },
        },
      }),
      this.prisma.files.count({
        where: {
          data_room_id: folder.dataRoomId,
          folder: { path: { startsWith: folder.path } },
        },
      }),
    ]);

    return { folders, files };
  }

  async listSubtreeStorageKeys(folder: FolderRecord): Promise<string[]> {
    const versions = await this.prisma.file_versions.findMany({
      where: {
        file: {
          data_room_id: folder.dataRoomId,
          folder: { path: { startsWith: folder.path } },
        },
      },
      select: { storage_key: true },
    });

    return versions.map((version) => version.storage_key);
  }

  async deleteById(
    id: string,
    after?: (tx: PrismaTx) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.folders.delete({ where: { id } });
      await after?.(tx);
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }
}

function toFolderRecord(folder: {
  id: string;
  name: string;
  parent_id: string | null;
  data_room_id: string;
  path: string;
  created_at: Date;
  data_room: { owner_id: string };
}): FolderRecord {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    dataRoomId: folder.data_room_id,
    ownerId: folder.data_room.owner_id,
    path: folder.path,
    createdAt: folder.created_at,
  };
}
