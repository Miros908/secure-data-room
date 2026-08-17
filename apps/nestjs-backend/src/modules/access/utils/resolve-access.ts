import {
  ROLE_RANK,
  type EffectiveRole,
  type GrantRole,
} from '../access.constants';
import type { AccessSubject } from '../access.types';
import { coveringFolderIds } from './folder-path';

export function maxRole(
  left: EffectiveRole,
  right: EffectiveRole,
): EffectiveRole {
  return ROLE_RANK[left] >= ROLE_RANK[right] ? left : right;
}

export function canWrite(role: EffectiveRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.editor;
}

export function canShare(role: EffectiveRole): boolean {
  return role === 'owner';
}

export function isGrantUpgrade(
  current: GrantRole,
  incoming: GrantRole,
): boolean {
  return ROLE_RANK[incoming] > ROLE_RANK[current];
}

export function toCoveringQuery(subject: AccessSubject) {
  return {
    dataRoomId: subject.dataRoomId,
    folderIds: coveringFolderIds(subject),
    fileId: subject.type === 'file' ? subject.id : undefined,
  };
}

export function resolveEffectiveRole(params: {
  userId: string | null;
  ownerId: string;
  grantRoles: GrantRole[];
}): EffectiveRole {
  if (params.userId && params.userId === params.ownerId) {
    return 'owner';
  }

  if (!params.userId) {
    return 'none';
  }

  return params.grantRoles.reduce<EffectiveRole>(
    (highest, role) => maxRole(highest, role),
    'none',
  );
}

export function roleFromPublicLink(covers: boolean): EffectiveRole {
  return covers ? 'viewer' : 'none';
}

export function toVisibleRole(
  role: EffectiveRole,
): Exclude<EffectiveRole, 'none'> {
  if (role === 'none') {
    throw new Error('unexpected_none_role');
  }

  return role;
}
