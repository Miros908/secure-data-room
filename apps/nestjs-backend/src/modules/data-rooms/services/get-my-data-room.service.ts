import { Injectable } from '@nestjs/common';
import type { DataRoom } from '@sdr/shared/data-rooms';
import { CreateOwnedDataRoomService } from './create-owned-data-room.service';
import { toDataRoomResponse } from '../utils/to-data-room-response';

export type GetMyDataRoomInput = {
  userId: string;
};

@Injectable()
export class GetMyDataRoomService {
  constructor(
    private readonly createOwnedDataRoomService: CreateOwnedDataRoomService,
  ) {}

  async execute(input: GetMyDataRoomInput): Promise<DataRoom> {
    const room = await this.createOwnedDataRoomService.execute({
      ownerId: input.userId,
    });

    return toDataRoomResponse(room, 'owner');
  }
}
