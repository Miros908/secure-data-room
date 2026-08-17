import { Injectable } from '@nestjs/common';
import type {
  InheritedShareLayer,
  ListSharesDto,
  ListSharesResponse,
} from '@sdr/shared/access';
import {
  AccessRepository,
  type AccessInvitationRecord,
  type ShareGrantRecord,
} from '../access.repository';
import type { AccessSubject } from '../access.types';
import { toIsoOrNull } from '../utils/access-expiry';
import {
  inheritedAncestorChain,
  inheritedFolderIds,
} from '../utils/sharing-coverage';
import type { AccessTarget } from '../utils/subject-target';
import { ResolveService } from './resolve.service';

export type ListSharesInput = ListSharesDto & {
  actorId: string;
};

@Injectable()
export class ListSharesService {
  constructor(
    private readonly accessRepository: AccessRepository,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: ListSharesInput): Promise<ListSharesResponse> {
    const { subject, target } =
      await this.resolveService.requireShareableSubject(
        input.actorId,
        input.type,
        input.id,
      );

    const [grants, invitations, publicLink, inherited] = await Promise.all([
      this.accessRepository.listGrantsForTarget(target),
      this.accessRepository.listPendingInvitesForTarget(target),
      this.accessRepository.findActivePublicLink(target),
      this.listInherited(subject),
    ]);

    return {
      grants: grants.map(toShareGrant),
      invitations: invitations.map(toShareInvitation),
      publicLink: publicLink
        ? {
            id: publicLink.id,
            expiresAt: publicLink.expiresAt?.toISOString() ?? null,
          }
        : null,
      inherited,
    };
  }

  private async listInherited(
    subject: AccessSubject,
  ): Promise<InheritedShareLayer[]> {
    if (subject.type === 'data_room') {
      return [];
    }
    const folderIds = inheritedFolderIds(subject);
    const [folders, rooms] = await Promise.all([
      this.accessRepository.findFoldersMeta(folderIds),
      this.accessRepository.findDataRooms([subject.dataRoomId]),
    ]);
    const folderName = new Map(
      folders.map((folder) => [folder.id, folder.name]),
    );
    const dataRoomName = rooms[0]?.name ?? 'Мой диск';
    const ancestorFolders = folderIds.flatMap((id) => {
      const name = folderName.get(id);
      return name ? [{ id, name }] : [];
    });
    const chain = inheritedAncestorChain({
      dataRoomId: subject.dataRoomId,
      dataRoomName,
      ancestorFolders,
    });

    const layers = await Promise.all(
      chain.map(async (source) => {
        const ancestorTarget = toAncestorTarget(source);
        const [grants, invitations, publicLink] = await Promise.all([
          this.accessRepository.listGrantsForTarget(ancestorTarget),
          this.accessRepository.listPendingInvitesForTarget(ancestorTarget),
          this.accessRepository.findActivePublicLink(ancestorTarget),
        ]);

        if (
          grants.length === 0 &&
          invitations.length === 0 &&
          publicLink === null
        ) {
          return null;
        }

        return {
          source,
          grants: grants.map(toShareGrant),
          invitations: invitations.map(toShareInvitation),
          publicLink: publicLink
            ? {
                id: publicLink.id,
                expiresAt: publicLink.expiresAt?.toISOString() ?? null,
              }
            : null,
        };
      }),
    );

    return layers.filter((layer) => layer !== null);
  }
}

function toAncestorTarget(source: {
  type: 'data_room' | 'folder';
  id: string;
  dataRoomId: string;
}): AccessTarget {
  return {
    dataRoomId: source.dataRoomId,
    folderId: source.type === 'folder' ? source.id : null,
    fileId: null,
  };
}

function toShareGrant(grant: ShareGrantRecord) {
  return {
    id: grant.id,
    userId: grant.userId,
    email: grant.email,
    name: grant.name,
    role: grant.role,
    expiresAt: toIsoOrNull(grant.expiresAt),
  };
}

function toShareInvitation(invite: AccessInvitationRecord) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    accessExpiresAt: toIsoOrNull(invite.accessExpiresAt),
  };
}
