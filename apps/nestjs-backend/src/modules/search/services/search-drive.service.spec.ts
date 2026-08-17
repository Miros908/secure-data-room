import { NotFoundException } from '@nestjs/common';
import type { AccessRepository } from '../../access/access.repository';
import type { SearchRepository } from '../search.repository';
import { encodeSearchCursor } from '../utils/search-cursor';
import { SearchDriveService } from './search-drive.service';

describe('SearchDriveService', () => {
  const searchRepository = {
    searchHits: jest.fn(),
  };
  const accessRepository = {
    findSubject: jest.fn(),
    listActiveGrantsInRoom: jest.fn(),
    findActivePublicLinkByTokenHash: jest.fn(),
    findFoldersMeta: jest.fn(),
  };
  const service = new SearchDriveService(
    searchRepository as unknown as SearchRepository,
    accessRepository as unknown as AccessRepository,
  );

  const room = {
    type: 'data_room' as const,
    id: 'room-1',
    dataRoomId: 'room-1',
    ownerId: 'owner-1',
    folderId: null,
    folderPath: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accessRepository.findSubject.mockResolvedValue(room);
    accessRepository.findFoldersMeta.mockResolvedValue([]);
    searchRepository.searchHits.mockResolvedValue([]);
  });

  it('returns 404 when the data room does not exist', async () => {
    accessRepository.findSubject.mockResolvedValue(null);

    await expect(
      service.execute({ q: 'nda', dataRoomId: 'room-1', userId: 'owner-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 when the caller has no access', async () => {
    accessRepository.listActiveGrantsInRoom.mockResolvedValue([]);

    await expect(
      service.execute({ q: 'nda', dataRoomId: 'room-1', userId: 'stranger' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(searchRepository.searchHits).not.toHaveBeenCalled();
  });

  it('owner search uses room visibility and maps file hits', async () => {
    searchRepository.searchHits.mockResolvedValue([
      {
        id: 'file-1',
        name: 'NDA.pdf',
        kind: 'file',
        parent_id: 'folder-1',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        mime_type: 'application/pdf',
        size_bytes: 12,
        version_count: 1,
        folder_path: '/folder-1/',
      },
    ]);
    accessRepository.findFoldersMeta.mockResolvedValue([
      {
        id: 'folder-1',
        name: 'Legal',
        path: '/folder-1/',
        parentId: null,
        dataRoomId: 'room-1',
      },
    ]);

    const result = await service.execute({
      q: 'nda',
      dataRoomId: 'room-1',
      userId: 'owner-1',
    });

    expect(searchRepository.searchHits).toHaveBeenCalledWith(
      expect.objectContaining({
        dataRoomId: 'room-1',
        query: 'nda',
        visibility: { type: 'room' },
        take: 21,
      }),
    );
    expect(result.role).toBe('owner');
    expect(result.items).toEqual([
      expect.objectContaining({
        kind: 'file',
        id: 'file-1',
        name: 'NDA.pdf',
        parentId: 'folder-1',
        breadcrumbs: [{ id: 'folder-1', name: 'Legal' }],
      }),
    ]);
  });

  it('returns an empty page for a broken cursor', async () => {
    const result = await service.execute({
      q: 'nda',
      dataRoomId: 'room-1',
      userId: 'owner-1',
      cursor: 'not-a-cursor',
    });

    expect(result.items).toEqual([]);
    expect(searchRepository.searchHits).not.toHaveBeenCalled();
  });

  it('encodes nextCursor when the page is full', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `File ${String(index).padStart(2, '0')}.pdf`,
      kind: 'file' as const,
      parent_id: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      mime_type: 'application/pdf',
      size_bytes: 1,
      version_count: 1,
      folder_path: null,
    }));
    searchRepository.searchHits.mockResolvedValue(rows);

    const result = await service.execute({
      q: 'file',
      dataRoomId: 'room-1',
      userId: 'owner-1',
    });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe(
      encodeSearchCursor({
        name: rows[19].name,
        kind: 'file',
        id: rows[19].id,
      }),
    );
  });
});
