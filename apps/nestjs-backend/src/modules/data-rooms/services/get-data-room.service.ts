import { Injectable, NotFoundException } from '@nestjs/common';
import type { DataRoom } from '@sdr/shared/data-rooms';
import { ResolveService } from '../../access/services/resolve.service';
import { DataRoomsRepository } from '../data-rooms.repository';
import { toDataRoomResponse } from '../utils/to-data-room-response';

export type GetDataRoomInput = {
  id: string;
  userId?: string | null;
  token?: string | null;
};

@Injectable()
export class GetDataRoomService {
  constructor(
    private readonly dataRoomsRepository: DataRoomsRepository,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: GetDataRoomInput): Promise<DataRoom> {
    const { subject, role, accessExpiresAt } =
      await this.resolveService.requireReadableSubject('data_room', input.id, {
        userId: input.userId,
        token: input.token,
      });

    const room = await this.dataRoomsRepository.findById(subject.id);

    if (!room || role === 'none') {
      throw new NotFoundException('not_found');
    }

    return toDataRoomResponse(room, role, accessExpiresAt);
  }
}
