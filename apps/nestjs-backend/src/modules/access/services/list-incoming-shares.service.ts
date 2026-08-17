import { Injectable } from '@nestjs/common';
import type { ListIncomingSharesResponse } from '@sdr/shared/access';
import { AccessRepository } from '../access.repository';
import { toIsoOrNull } from '../utils/access-expiry';

export type ListIncomingSharesInput = {
  userId: string;
};

@Injectable()
export class ListIncomingSharesService {
  constructor(private readonly accessRepository: AccessRepository) {}

  async execute(
    input: ListIncomingSharesInput,
  ): Promise<ListIncomingSharesResponse> {
    const grants = await this.accessRepository.listIncomingGrants(input.userId);

    const rooms: ListIncomingSharesResponse['rooms'] = [];
    const folders: ListIncomingSharesResponse['folders'] = [];
    const files: ListIncomingSharesResponse['files'] = [];

    for (const grant of grants) {
      if (grant.file) {
        files.push({
          id: grant.file.id,
          name: grant.file.name,
          dataRoomId: grant.dataRoomId,
          role: grant.role,
          accessExpiresAt: toIsoOrNull(grant.expiresAt),
        });
        continue;
      }

      if (grant.folder) {
        folders.push({
          id: grant.folder.id,
          name: grant.folder.name,
          dataRoomId: grant.dataRoomId,
          role: grant.role,
          accessExpiresAt: toIsoOrNull(grant.expiresAt),
        });
        continue;
      }

      rooms.push({
        id: grant.dataRoomId,
        name: grant.dataRoomName,
        role: grant.role,
        accessExpiresAt: toIsoOrNull(grant.expiresAt),
      });
    }

    return { rooms, folders, files };
  }
}
