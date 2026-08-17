import { describe, expect, it } from 'vitest';
import { getMessages } from '@/app/lib/i18n/get-messages';
import {
  liveAccessClosed,
  liveFileNotFoundMessage,
  liveFolderNotFoundMessage,
} from '@/app/lib/live-access-copy';

const ROOM = '11111111-1111-4111-8111-111111111111';
const FILE = '22222222-2222-4222-8222-222222222222';
const { live } = getMessages();

describe('live access copy', () => {
  it('does not override a cold 404', () => {
    expect(liveFileNotFoundMessage(null)).toBeUndefined();
    expect(liveFolderNotFoundMessage(null)).toBeUndefined();
  });

  it('uses revoke copy for access_invalidated', () => {
    expect(
      liveFileNotFoundMessage({
        type: 'access_invalidated',
        reason: 'revoked',
        dataRoomId: ROOM,
        target: { kind: 'file', id: FILE },
      }),
    ).toBe(live.fileRevoked);
    expect(
      liveFolderNotFoundMessage({
        type: 'access_invalidated',
        reason: 'revoked',
        dataRoomId: ROOM,
        target: { kind: 'folder', id: FILE },
      }),
    ).toBe(live.folderGone);
  });

  it('uses deleted copy for resource_gone', () => {
    expect(
      liveFileNotFoundMessage({
        type: 'resource_gone',
        reason: 'deleted',
        dataRoomId: ROOM,
        subject: { kind: 'file', id: FILE },
      }),
    ).toBe(live.fileDeleted);
  });

  it('treats revoke and delete as closed access', () => {
    expect(
      liveAccessClosed({
        type: 'access_invalidated',
        reason: 'revoked',
        dataRoomId: ROOM,
        target: { kind: 'file', id: FILE },
      }),
    ).toBe(true);
    expect(
      liveAccessClosed({
        type: 'resource_gone',
        reason: 'deleted',
        dataRoomId: ROOM,
        subject: { kind: 'file', id: FILE },
      }),
    ).toBe(true);
    expect(
      liveAccessClosed({
        type: 'activity_recorded',
        dataRoomId: ROOM,
      }),
    ).toBe(false);
    expect(liveAccessClosed(null)).toBe(false);
  });

  it('ignores activity_recorded for 404 copy', () => {
    expect(
      liveFileNotFoundMessage({
        type: 'activity_recorded',
        dataRoomId: ROOM,
      }),
    ).toBeUndefined();
    expect(
      liveFolderNotFoundMessage({
        type: 'activity_recorded',
        dataRoomId: ROOM,
      }),
    ).toBeUndefined();
  });
});
