import type { ActivityEventType } from '../../database/generated/prisma/enums';
import type { PrismaTx } from '../../database/prisma-transaction';

export type ActivityAppendInput = {
  type: ActivityEventType;
  dataRoomId: string;
  actorUserId?: string | null;
  publicShareLinkId?: string | null;
  fileId?: string | null;
  folderId?: string | null;
  resourceName?: string | null;
  metadata?: Record<string, unknown> | null;
  dedupe?: boolean;
};

export type ActivityFileSnapshot = {
  id: string;
  name: string;
  dataRoomId: string;
  folderId: string | null;
  storageKey: string;
  mimeType: string;
};

export type ActivityFileVersionSnapshot = {
  id: string;
  fileId: string;
  storageKey: string;
  mimeType: string;
};

export type ActivityOwnedRoom = {
  id: string;
  ownerId: string;
};

export type ActivityTx = PrismaTx;
