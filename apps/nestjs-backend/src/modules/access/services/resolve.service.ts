import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EffectiveRole } from '../access.constants';
import { AccessRepository } from '../access.repository';
import type { AccessSubject, ResolveAccessParams } from '../access.types';
import { mergeAccessExpiry } from '../utils/access-expiry';
import {
  canShare,
  canWrite,
  resolveEffectiveRole,
  roleFromPublicLink,
  toCoveringQuery,
} from '../utils/resolve-access';
import { hashShareToken } from '../utils/share-token';
import { toAccessTarget, type AccessTarget } from '../utils/subject-target';

export type ResolvedAccess = {
  role: EffectiveRole;
  accessExpiresAt: Date | null;
};

@Injectable()
export class ResolveService {
  constructor(private readonly accessRepository: AccessRepository) {}

  async execute(params: ResolveAccessParams): Promise<EffectiveRole> {
    return (await this.resolveAccess(params)).role;
  }

  async resolveAccess(params: ResolveAccessParams): Promise<ResolvedAccess> {
    const session = await this.resolveSessionAccess(
      params.userId ?? null,
      params.subject,
    );
    const tokenHash = toTokenHash(params);

    if (session.role !== 'none' || !tokenHash) {
      return session;
    }

    return this.resolvePublicTokenAccess(tokenHash, params.subject);
  }

  async executeByPublicToken(
    tokenHash: string,
    subject: AccessSubject,
  ): Promise<EffectiveRole> {
    return (await this.resolvePublicTokenAccess(tokenHash, subject)).role;
  }

  async assertCanRead(params: ResolveAccessParams): Promise<EffectiveRole> {
    const role = await this.execute(params);

    if (role === 'none') {
      throw new NotFoundException('not_found');
    }

    return role;
  }

  async assertCanWrite(params: ResolveAccessParams): Promise<EffectiveRole> {
    const role = await this.assertCanRead(params);

    if (!canWrite(role)) {
      throw new ForbiddenException('forbidden');
    }

    return role;
  }

  async assertCanShare(
    userId: string,
    subject: AccessSubject,
  ): Promise<EffectiveRole> {
    const role = await this.assertCanRead({ userId, subject });

    if (!canShare(role)) {
      throw new ForbiddenException('forbidden');
    }

    return role;
  }

  async requireShareableSubject(
    actorId: string,
    type: AccessSubject['type'],
    id: string,
  ): Promise<{ subject: AccessSubject; target: AccessTarget }> {
    const subject = await this.accessRepository.findSubject(type, id);

    if (!subject) {
      throw new NotFoundException('not_found');
    }

    await this.assertCanShare(actorId, subject);

    return { subject, target: toAccessTarget(subject) };
  }

  async requireReadableSubject(
    type: AccessSubject['type'],
    id: string,
    access: { userId?: string | null; token?: string | null },
  ): Promise<{
    subject: AccessSubject;
    role: EffectiveRole;
    accessExpiresAt: Date | null;
  }> {
    const subject = await this.accessRepository.findSubject(type, id);

    if (!subject) {
      throw new NotFoundException('not_found');
    }

    const resolved = await this.resolveAccess({
      userId: access.userId,
      token: access.token,
      subject,
    });

    if (resolved.role === 'none') {
      throw new NotFoundException('not_found');
    }

    return {
      subject,
      role: resolved.role,
      accessExpiresAt: resolved.accessExpiresAt,
    };
  }

  async requireWritableSubject(
    type: AccessSubject['type'],
    id: string,
    userId: string,
  ): Promise<{ subject: AccessSubject; role: EffectiveRole }> {
    const subject = await this.accessRepository.findSubject(type, id);

    if (!subject) {
      throw new NotFoundException('not_found');
    }

    const role = await this.assertCanWrite({ userId, subject });

    return { subject, role };
  }

  listRoomLevelGrantedDataRoomIds(userId: string): Promise<string[]> {
    return this.accessRepository.findRoomLevelGrantedDataRoomIds(userId);
  }

  listAccessibleDataRoomIds(userId: string): Promise<string[]> {
    return this.accessRepository.findAccessibleDataRoomIds(userId);
  }

  private async resolveSessionAccess(
    userId: string | null,
    subject: AccessSubject,
  ): Promise<ResolvedAccess> {
    const ownedOrAnonymous = resolveEffectiveRole({
      userId,
      ownerId: subject.ownerId,
      grantRoles: [],
    });

    if (ownedOrAnonymous === 'owner' || !userId) {
      return { role: ownedOrAnonymous, accessExpiresAt: null };
    }

    const grants = await this.accessRepository.findCoveringGrants({
      userId,
      ...toCoveringQuery(subject),
    });
    const role = resolveEffectiveRole({
      userId,
      ownerId: subject.ownerId,
      grantRoles: grants.map((grant) => grant.role),
    });

    if (role === 'none') {
      return { role: 'none', accessExpiresAt: null };
    }

    return {
      role,
      accessExpiresAt: mergeAccessExpiry(
        grants.map((grant) => grant.expiresAt),
      ),
    };
  }

  private async resolvePublicTokenAccess(
    tokenHash: string,
    subject: AccessSubject,
  ): Promise<ResolvedAccess> {
    const link = await this.accessRepository.findCoveringPublicLink({
      tokenHash,
      ...toCoveringQuery(subject),
    });

    if (!link) {
      return { role: 'none', accessExpiresAt: null };
    }

    return {
      role: roleFromPublicLink(true),
      accessExpiresAt: link.expiresAt,
    };
  }
}

function toTokenHash(params: ResolveAccessParams): string | null {
  if (params.tokenHash) {
    return params.tokenHash;
  }

  if (params.token) {
    return hashShareToken(params.token);
  }

  return null;
}
