import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../../../database/generated/prisma/client';
import { MAX_FILE_BYTES, PDF_MIME_TYPE } from '../files.constants';
import type { FilesRepository } from '../files.repository';
import type { FileRecord } from '../files.types';
import type { ResolveService } from '../../access/services/resolve.service';
import type { StorageService } from '../../../infrastructure/storage/storage.service';
import { UploadFileService } from './upload-file.service';

const pdf = Buffer.from('%PDF-1.7 content');
const created: FileRecord = {
  id: 'file-1',
  name: 'report.pdf',
  dataRoomId: 'room-1',
  folderId: 'folder-1',
  mimeType: PDF_MIME_TYPE,
  sizeBytes: pdf.length,
  storageKey: 'room-1/file-1/version-1',
  currentVersionId: 'version-1',
  versionNumber: 1,
  versionCount: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
const versioned: FileRecord = {
  ...created,
  currentVersionId: 'version-2',
  versionNumber: 2,
  versionCount: 2,
  storageKey: 'room-1/file-1/version-2',
  sizeBytes: pdf.length,
};

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('UploadFileService', () => {
  const filesRepository = {
    folderExistsInRoom: jest.fn(),
    findSibling: jest.fn(),
    create: jest.fn(),
    addVersion: jest.fn(),
  };
  const resolveService = {
    requireWritableSubject: jest.fn(),
  };
  const storage = {
    put: jest.fn(),
    delete: jest.fn(),
  };
  const service = new UploadFileService(
    filesRepository as unknown as FilesRepository,
    resolveService as unknown as ResolveService,
    storage as unknown as StorageService,
    { keyPrefix: '', driver: 'local', local: {} as never, r2: null },
  );

  const input = {
    userId: 'user-1',
    dataRoomId: 'room-1',
    folderId: 'folder-1',
    name: 'report.pdf',
    originalName: 'report.pdf',
    mimeType: 'application/pdf',
    body: pdf,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveService.requireWritableSubject.mockResolvedValue({
      subject: { id: 'folder-1', dataRoomId: 'room-1' },
      role: 'editor',
    });
    filesRepository.folderExistsInRoom.mockResolvedValue(true);
    filesRepository.findSibling.mockResolvedValue(null);
    filesRepository.create.mockResolvedValue(created);
    filesRepository.addVersion.mockResolvedValue(versioned);
    storage.put.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
  });

  it('rejects an empty body before ACL', async () => {
    await expect(
      service.execute({ ...input, body: Buffer.alloc(0) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(resolveService.requireWritableSubject).not.toHaveBeenCalled();
  });

  it('rejects a body over the size limit', async () => {
    await expect(
      service.execute({
        ...input,
        body: { length: MAX_FILE_BYTES + 1 } as Buffer,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('file_too_large'),
    });
    expect(resolveService.requireWritableSubject).not.toHaveBeenCalled();
  });

  it('rejects non-PDF bytes', async () => {
    await expect(
      service.execute({ ...input, body: Buffer.from('hello') }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('invalid_file_type'),
    });
  });

  it('rejects a folder that is not in the data room', async () => {
    filesRepository.folderExistsInRoom.mockResolvedValue(false);

    await expect(service.execute(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('checks room write access when uploading to the root', async () => {
    await service.execute({ ...input, folderId: undefined });

    expect(resolveService.requireWritableSubject).toHaveBeenCalledWith(
      'data_room',
      'room-1',
      'user-1',
    );
    expect(filesRepository.folderExistsInRoom).not.toHaveBeenCalled();
  });

  it('appends a version when the sibling name is taken', async () => {
    filesRepository.findSibling.mockResolvedValue(created);

    const result = await service.execute(input);

    expect(resolveService.requireWritableSubject).toHaveBeenCalledWith(
      'file',
      'file-1',
      'user-1',
    );
    expect(filesRepository.create).not.toHaveBeenCalled();
    expect(filesRepository.addVersion).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'file-1',
      isNewVersion: true,
      versionNumber: 2,
      versionCount: 2,
    });
  });

  it('rejects a viewer who cannot write the existing file', async () => {
    filesRepository.findSibling.mockResolvedValue(created);
    resolveService.requireWritableSubject.mockRejectedValue(
      new ForbiddenException('forbidden'),
    );

    await expect(service.execute(input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('writes storage then the database row for a new name', async () => {
    const result = await service.execute(input);

    expect(storage.put).toHaveBeenCalledWith({
      key: expect.stringMatching(/^room-1\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/),
      body: pdf,
      contentType: PDF_MIME_TYPE,
    });
    expect(filesRepository.create).toHaveBeenCalled();
    expect(result).toMatchObject({
      name: 'report.pdf',
      dataRoomId: 'room-1',
      folderId: 'folder-1',
      mimeType: PDF_MIME_TYPE,
      sizeBytes: pdf.length,
      isNewVersion: false,
      versionNumber: 1,
    });
  });

  it('retries create as addVersion after a P2002 race', async () => {
    filesRepository.findSibling
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    filesRepository.create.mockRejectedValue(uniqueError());

    const result = await service.execute(input);

    expect(storage.delete).toHaveBeenCalled();
    expect(filesRepository.addVersion).toHaveBeenCalled();
    expect(result.isNewVersion).toBe(true);
  });

  it('deletes the object when create throws a non-conflict error', async () => {
    const boom = new Error('db down');
    filesRepository.create.mockRejectedValue(boom);
    storage.delete.mockRejectedValue(new Error('storage down'));

    await expect(service.execute(input)).rejects.toBe(boom);
    expect(storage.delete).toHaveBeenCalled();
  });

  it('deletes the object when addVersion fails', async () => {
    filesRepository.findSibling.mockResolvedValue(created);
    const boom = new Error('version insert failed');
    filesRepository.addVersion.mockRejectedValue(boom);

    await expect(service.execute(input)).rejects.toBe(boom);
    expect(storage.delete).toHaveBeenCalled();
  });
});
