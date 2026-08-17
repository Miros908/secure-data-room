import type { EffectiveRole } from '../../access/access.constants';
import { toIsoOrNull } from '../../access/utils/access-expiry';
import type { DataRoom } from '@sdr/shared/data-rooms';
import type { DataRoomRecord } from '../data-rooms.types';

export function toDataRoomResponse(
  room: DataRoomRecord,
  role: Exclude<EffectiveRole, 'none'>,
  accessExpiresAt?: Date | null,
): DataRoom {
  return {
    id: room.id,
    name: room.name,
    role,
    accessExpiresAt: toIsoOrNull(accessExpiresAt),
    createdAt: room.createdAt.toISOString(),
  };
}
