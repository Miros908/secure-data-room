import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { InviteAccessDto, InviteAccessResponse } from '@sdr/shared/access';
import { INVITE_TTL_MS } from '../access.constants';
import { AccessRepository } from '../access.repository';
import {
  inviteAcceptDeadline,
  parseAccessExpiresAt,
  toIsoOrNull,
} from '../utils/access-expiry';
import { assertNotCoveredByAncestor } from '../utils/covered-by-ancestor';
import { generateShareToken, hashShareToken } from '../utils/share-token';
import { toSubjectRef } from '../utils/subject-target';
import { GrantService } from './grant.service';
import { ResolveService } from './resolve.service';

export type InviteAccessInput = InviteAccessDto & {
  grantedById: string;
};

@Injectable()
export class InviteService {
  constructor(
    private readonly accessRepository: AccessRepository,
    private readonly grantService: GrantService,
    private readonly resolveService: ResolveService,
  ) {}

  async execute(input: InviteAccessInput): Promise<InviteAccessResponse> {
    const { subject, target } =
      await this.resolveService.requireShareableSubject(
        input.grantedById,
        input.type,
        input.id,
      );

    const email = input.email.trim().toLowerCase();
    const actor = await this.accessRepository.findActiveUser(input.grantedById);
    const owner = await this.accessRepository.findActiveUser(subject.ownerId);

    if (actor && email === actor.email) {
      throw new BadRequestException('cannot_invite_self');
    }

    if (owner && email === owner.email) {
      throw new BadRequestException('cannot_invite_owner');
    }

    const accessExpiresAt = parseAccessExpiresAt(input.expiresAt);
    const existingUser = await this.accessRepository.findUserByEmail(email);

    if (existingUser) {
      const grant = await this.grantService.execute({
        userId: existingUser.id,
        role: input.role,
        type: input.type,
        id: input.id,
        expiresAt: input.expiresAt,
        grantedById: input.grantedById,
      });

      return {
        id: grant.id,
        email: existingUser.email,
        role: grant.role,
        type: grant.type,
        subjectId: grant.subjectId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        accessExpiresAt: grant.expiresAt,
        token: generateShareToken(),
      };
    }

    const pending = await this.accessRepository.findPendingInvite({
      email,
      ...target,
    });

    if (pending) {
      throw new ConflictException('already_invited');
    }

    await assertNotCoveredByAncestor(this.accessRepository, {
      subject,
      email,
    });

    const token = generateShareToken();
    const invite = await this.accessRepository.createInvite({
      email,
      grantedById: input.grantedById,
      tokenHash: hashShareToken(token),
      role: input.role,
      expiresAt: inviteAcceptDeadline(accessExpiresAt, INVITE_TTL_MS),
      accessExpiresAt,
      ...target,
    });

    const { type, subjectId } = toSubjectRef(invite);

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      type,
      subjectId,
      expiresAt: invite.expiresAt.toISOString(),
      accessExpiresAt: toIsoOrNull(invite.accessExpiresAt),
      token,
    };
  }
}
