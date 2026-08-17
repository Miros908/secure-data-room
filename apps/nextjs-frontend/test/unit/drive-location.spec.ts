import { describe, expect, it } from 'vitest';
import {
  canShareDrive,
  canWriteDrive,
  driveHref,
  parseDriveView,
  parseUuid,
  isDriveSectionView,
} from '@/app/(pages)/drive/components/drive-location';

const FOLDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FILE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ROOM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('drive-location', () => {
  it('parseUuid keeps a UUID and drops junk', () => {
    expect(parseUuid(FOLDER_ID)).toBe(FOLDER_ID);
    expect(parseUuid('not-a-uuid')).toBeUndefined();
    expect(parseUuid(null)).toBeUndefined();
  });

  it('parseDriveView only accepts known section views', () => {
    expect(parseDriveView('outgoing')).toBe('outgoing');
    expect(parseDriveView('incoming')).toBe('incoming');
    expect(parseDriveView('activity')).toBe('activity');
    expect(parseDriveView('folder')).toBe('folder');
    expect(parseDriveView('trash')).toBe('folder');
    expect(isDriveSectionView('incoming')).toBe(true);
    expect(isDriveSectionView('folder')).toBe(false);
  });

  it('driveHref uses folderId and fileId, not names', () => {
    expect(driveHref({ folderId: FOLDER_ID, dataRoomId: ROOM_ID })).toContain(
      `folderId=${FOLDER_ID}`,
    );
    expect(driveHref({ fileId: FILE_ID })).toBe(`/drive?fileId=${FILE_ID}`);
    expect(
      driveHref({ fileId: FILE_ID, dataRoomId: ROOM_ID, myRoomId: FOLDER_ID }),
    ).toBe(`/drive?fileId=${FILE_ID}&dataRoomId=${ROOM_ID}`);
    expect(
      driveHref({
        folderId: FOLDER_ID,
        dataRoomId: ROOM_ID,
        fileId: FILE_ID,
      }),
    ).toBe(
      `/drive?folderId=${FOLDER_ID}&dataRoomId=${ROOM_ID}&fileId=${FILE_ID}`,
    );
    expect(driveHref({ view: 'activity' })).toBe('/drive?view=activity');
    expect(driveHref({ view: 'incoming' })).toBe('/drive?view=incoming');
    expect(
      driveHref({
        folderId: FOLDER_ID,
        dataRoomId: ROOM_ID,
        myRoomId: FILE_ID,
      }),
    ).toBe(`/drive?folderId=${FOLDER_ID}&dataRoomId=${ROOM_ID}`);
    expect(driveHref({ folderId: FOLDER_ID, dataRoomId: ROOM_ID })).not.toContain(
      'name=',
    );
  });

  it('canWriteDrive / canShareDrive follow role', () => {
    expect(canWriteDrive('owner')).toBe(true);
    expect(canWriteDrive('editor')).toBe(true);
    expect(canWriteDrive('viewer')).toBe(false);
    expect(canShareDrive('owner')).toBe(true);
    expect(canShareDrive('editor')).toBe(false);
  });
});
