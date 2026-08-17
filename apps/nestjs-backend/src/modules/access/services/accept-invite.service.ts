import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AcceptInviteResponse } from '@sdr/shared/access';
import { ActivityEventType } from '../../../database/generated/prisma/enums';
import { ActivityRepository } from '../../activity/activity.repository';
import { activityResourceName } from '../../activity/utils/resource-name';
import { EventsBroker } from '../../events/events.broker';
import {
  AccessRepository,
  type AccessInvitationRecord,
} from '../access.repository';
import { accessGrantedEvent } from '../utils/access-live-event';
import { hashShareToken } from '../utils/share-token';

export type AcceptInviteInput = {
  userId: string;
  email: string;
  token?: string;
};

@Injectable()
export class AcceptInviteService {
  constructor(
    private readonly accessRepository: AccessRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly eventsBroker: EventsBroker,
  ) {}

  async execute(input: AcceptInviteInput): Promise<AcceptInviteResponse> {
    const email = input.email.trim().toLowerCase();

    if (input.token) {
      await this.acceptByToken(input.userId, email, input.token);
      return { accepted: 1 };
    }

    const invites =
      await this.accessRepository.findPendingInvitesByEmail(email);

    for (const invite of invites) {
      await this.accept(input.userId, invite);
    }

    return { accepted: invites.length };
  }

  private async acceptByToken(
    userId: string,
    email: string,
    token: string,
  ): Promise<void> {
    const invite = await this.accessRepository.findPendingInviteByTokenHash(
      hashShareToken(token),
    );

    if (!invite) {
      throw new NotFoundException('not_found');
    }

    if (invite.email !== email) {
      throw new ForbiddenException('forbidden');
    }

    await this.accept(userId, invite);
  }

  private async accept(
    userId: string,
    invite: AccessInvitationRecord,
  ): Promise<void> {
    const resourceName = await activityResourceName(this.accessRepository, {
      dataRoomId: invite.dataRoomId,
      folderId: invite.folderId,
      fileId: invite.fileId,
    });

    return this.accessRepository
      .acceptInvitation(
        {
          invitationId: invite.id,
          userId,
          grantedById: invite.grantedById,
          dataRoomId: invite.dataRoomId,
          folderId: invite.folderId,
          fileId: invite.fileId,
          role: invite.role,
          expiresAt: invite.accessExpiresAt,
        },
        (tx) =>
          this.activityRepository
            .append(
              {
                type: ActivityEventType.ACCESS_GRANTED,
                dataRoomId: invite.dataRoomId,
                actorUserId: userId,
                fileId: invite.fileId,
                folderId: invite.folderId,
                resourceName,
                metadata: {
                  kind: 'invite',
                  role: invite.role,
                  email: invite.email,
                },
              },
              tx,
            )
            .then(() => undefined),
      )
      .then(() => {
        const event = accessGrantedEvent({
          dataRoomId: invite.dataRoomId,
          folderId: invite.folderId,
          fileId: invite.fileId,
        });
        this.eventsBroker.publishToUser(userId, event);
        this.eventsBroker.publishToDataRoom(invite.dataRoomId, event);
      });
  }
}
