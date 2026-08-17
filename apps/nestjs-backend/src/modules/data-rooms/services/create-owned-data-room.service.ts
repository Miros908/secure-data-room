import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../database/generated/prisma/client';
import { DEFAULT_DATA_ROOM_NAME } from '../data-rooms.constants';
import { DataRoomsRepository } from '../data-rooms.repository';
import type { DataRoomRecord } from '../data-rooms.types';

export type CreateOwnedDataRoomInput = {
  ownerId: string;
  name?: string;
};

@Injectable()
export class CreateOwnedDataRoomService {
  constructor(private readonly dataRoomsRepository: DataRoomsRepository) {}

  async execute(input: CreateOwnedDataRoomInput): Promise<DataRoomRecord> {
    const existing = await this.dataRoomsRepository.findByOwnerId(
      input.ownerId,
    );

    if (existing) {
      return existing;
    }

    try {
      return await this.dataRoomsRepository.create({
        ownerId: input.ownerId,
        name: input.name?.trim() || DEFAULT_DATA_ROOM_NAME,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.dataRoomsRepository.findByOwnerId(
          input.ownerId,
        );

        if (raced) {
          return raced;
        }
      }

      throw error;
    }
  }
}
