import type { AccessSubject } from '../access.types';
import { assertNotCoveredByAncestor } from './covered-by-ancestor';

const folderSubject: AccessSubject = {
  type: 'folder',
  id: 'folder-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  folderId: 'folder-1',
  folderPath: '/root/folder-1/',
};

const fileSubject: AccessSubject = {
  type: 'file',
  id: 'file-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  folderId: 'folder-1',
  folderPath: '/folder-1/',
};

const roomSubject: AccessSubject = {
  type: 'data_room',
  id: 'room-1',
  dataRoomId: 'room-1',
  ownerId: 'owner-1',
  folderId: null,
  folderPath: null,
};

describe('assertNotCoveredByAncestor', () => {
  const accessRepository = {
    hasCoveringAncestorGrant: jest.fn(),
    hasCoveringAncestorInvite: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    accessRepository.hasCoveringAncestorGrant.mockResolvedValue(false);
    accessRepository.hasCoveringAncestorInvite.mockResolvedValue(false);
  });

  it('does not query ancestors for a data room', async () => {
    await expect(
      assertNotCoveredByAncestor(accessRepository, {
        subject: roomSubject,
        userId: 'user-2',
        email: 'b@example.com',
      }),
    ).resolves.toBeUndefined();
    expect(accessRepository.hasCoveringAncestorGrant).not.toHaveBeenCalled();
    expect(accessRepository.hasCoveringAncestorInvite).not.toHaveBeenCalled();
  });

  it('rejects when an ancestor grant already covers the recipient', async () => {
    accessRepository.hasCoveringAncestorGrant.mockResolvedValue(true);

    await expect(
      assertNotCoveredByAncestor(accessRepository, {
        subject: fileSubject,
        userId: 'user-2',
        email: 'b@example.com',
      }),
    ).rejects.toMatchObject({ message: 'already_covered' });
    expect(accessRepository.hasCoveringAncestorGrant).toHaveBeenCalledWith({
      userId: 'user-2',
      dataRoomId: 'room-1',
      folderIds: ['folder-1'],
    });
  });

  it('rejects when an ancestor invite already covers the email', async () => {
    accessRepository.hasCoveringAncestorInvite.mockResolvedValue(true);

    await expect(
      assertNotCoveredByAncestor(accessRepository, {
        subject: folderSubject,
        email: 'new@example.com',
      }),
    ).rejects.toMatchObject({ message: 'already_covered' });
    expect(accessRepository.hasCoveringAncestorGrant).not.toHaveBeenCalled();
    expect(accessRepository.hasCoveringAncestorInvite).toHaveBeenCalledWith({
      email: 'new@example.com',
      dataRoomId: 'room-1',
      folderIds: ['root'],
    });
  });

  it('allows a grant when no ancestor covers the recipient', async () => {
    await expect(
      assertNotCoveredByAncestor(accessRepository, {
        subject: fileSubject,
        userId: 'user-2',
        email: 'b@example.com',
      }),
    ).resolves.toBeUndefined();
  });
});
