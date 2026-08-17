import { Injectable } from '@nestjs/common';
import type { ListDataRoomsResponse } from '@sdr/shared/data-rooms';
import { ResolveService } from '../../access/services/resolve.service';
import { DataRoomsRepository } from '../data-rooms.repository';
import { toDataRoomResponse } from '../utils/to-data-room-response';
import { CreateOwnedDataRoomService } from './create-owned-data-room.service';

export type ListDataRoomsInput = {
  userId: string;
};

@Injectable()
export class ListDataRoomsService {
  constructor(
    private readonly dataRoomsRepository: DataRoomsRepository,
    private readonly createOwnedDataRoomService: CreateOwnedDataRoomService,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: ListDataRoomsInput): Promise<ListDataRoomsResponse> {
    const myRoom = await this.createOwnedDataRoomService.execute({
      ownerId: input.userId,
    });

    const grantedIds =
      await this.resolveService.listRoomLevelGrantedDataRoomIds(input.userId);
    const sharedIds = grantedIds.filter((id) => id !== myRoom.id);
    const sharedRecords =
      await this.dataRoomsRepository.findManyByIds(sharedIds);

    const sharedRooms: ListDataRoomsResponse['sharedRooms'] = [];

    for (const room of sharedRecords) {
      const resolved = await this.resolveService.resolveAccess({
        userId: input.userId,
        subject: {
          type: 'data_room',
          id: room.id,
          dataRoomId: room.id,
          ownerId: room.ownerId,
          folderId: null,
          folderPath: null,
        },
      });

      if (resolved.role === 'none' || resolved.role === 'owner') {
        continue;
      }

      sharedRooms.push(
        toDataRoomResponse(room, resolved.role, resolved.accessExpiresAt),
      );
    }

    return {
      myRoom: toDataRoomResponse(myRoom, 'owner'),
      sharedRooms,
    };
  }
}
