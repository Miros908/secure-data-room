import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type PublicLinkAudience = {
  id: string;
  dataRoomId: string;
};

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActivePublicLinkByTokenHash(
    tokenHash: string,
  ): Promise<PublicLinkAudience | null> {
    const now = new Date();
    const link = await this.prisma.public_share_links.findFirst({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: { id: true, data_room_id: true },
    });

    return link ? { id: link.id, dataRoomId: link.data_room_id } : null;
  }

  async findAccessibleDataRoomId(
    userId: string,
    dataRoomId: string,
  ): Promise<string | null> {
    const now = new Date();
    const owned = await this.prisma.data_rooms.findFirst({
      where: { id: dataRoomId, owner_id: userId },
      select: { id: true },
    });

    if (owned) {
      return owned.id;
    }

    const grant = await this.prisma.access_grants.findFirst({
      where: {
        user_id: userId,
        data_room_id: dataRoomId,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: { id: true },
    });

    return grant ? dataRoomId : null;
  }
}
