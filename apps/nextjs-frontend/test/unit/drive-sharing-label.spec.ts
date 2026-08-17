import type { InheritedShareLayer } from '@sdr/shared/access';
import { describe, expect, it } from 'vitest';
import { coveredAncestorHint } from '@/app/(pages)/drive/components/drive-sharing-label';

const FOLDER_ID = '55555555-5555-4555-8555-555555555555';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';
const GRANT_ID = '66666666-6666-4666-8666-666666666666';
const USER_ID = '77777777-7777-4777-8777-777777777777';

const folderLayer: InheritedShareLayer = {
  source: {
    type: 'folder',
    id: FOLDER_ID,
    name: 'Договоры',
    dataRoomId: ROOM_ID,
  },
  grants: [
    {
      id: GRANT_ID,
      userId: USER_ID,
      email: 'colleague@company.com',
      name: 'Colleague',
      role: 'viewer',
      expiresAt: null,
    },
  ],
  invitations: [],
  publicLink: null,
};

describe('coveredAncestorHint', () => {
  it('names the nearest ancestor that already covers the email', () => {
    expect(coveredAncestorHint('Colleague@Company.com', [folderLayer])).toBe(
      'This person already has access from “Договоры”',
    );
  });

  it('returns null when the email is not in inherited layers', () => {
    expect(coveredAncestorHint('other@company.com', [folderLayer])).toBeNull();
  });
});
