import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { DataRoomRecord } from './data-rooms.types';

const ROOM_SELECT = {
  id: true,
  name: true,
  owner_id: true,
  created_at: true,
} as const;

@Injectable()
export class DataRoomsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOwnerId(ownerId: string): Promise<DataRoomRecord | null> {
    const room = await this.prisma.data_rooms.findUnique({
      where: { owner_id: ownerId },
      select: ROOM_SELECT,
    });

    return room ? toRoomRecord(room) : null;
  }

  async findById(id: string): Promise<DataRoomRecord | null> {
    const room = await this.prisma.data_rooms.findUnique({
      where: { id },
      select: ROOM_SELECT,
    });

    return room ? toRoomRecord(room) : null;
  }

  async findManyByIds(ids: string[]): Promise<DataRoomRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const rooms = await this.prisma.data_rooms.findMany({
      where: { id: { in: ids } },
      select: ROOM_SELECT,
      orderBy: { created_at: 'asc' },
    });

    return rooms.map(toRoomRecord);
  }

  async create(params: {
    ownerId: string;
    name: string;
  }): Promise<DataRoomRecord> {
    const room = await this.prisma.data_rooms.create({
      data: {
        owner_id: params.ownerId,
        name: params.name,
      },
      select: ROOM_SELECT,
    });

    return toRoomRecord(room);
  }
}

function toRoomRecord(room: {
  id: string;
  name: string;
  owner_id: string;
  created_at: Date;
}): DataRoomRecord {
  return {
    id: room.id,
    name: room.name,
    ownerId: room.owner_id,
    createdAt: room.created_at,
  };
}
