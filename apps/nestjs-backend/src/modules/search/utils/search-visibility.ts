import { maxRole } from '../../access/utils/resolve-access';
import { mergeAccessExpiry } from '../../access/utils/access-expiry';
import type { EffectiveRole } from '../../access/access.constants';

export type SearchVisibility =
  | { type: 'room' }
  | { type: 'restricted'; folderPaths: string[]; fileIds: string[] };

export type SearchScope = {
  role: EffectiveRole;
  accessExpiresAt: Date | null;
  visibility: SearchVisibility;
};

export function mergeSearchScopes(
  left: SearchScope | null,
  right: SearchScope | null,
): SearchScope | null {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  return {
    role: maxRole(left.role, right.role),
    accessExpiresAt: mergeAccessExpiry([
      left.accessExpiresAt,
      right.accessExpiresAt,
    ]),
    visibility: mergeVisibility(left.visibility, right.visibility),
  };
}

export function folderIsVisible(
  path: string,
  visibility: SearchVisibility,
): boolean {
  if (visibility.type === 'room') {
    return true;
  }

  return visibility.folderPaths.some((prefix) => path.startsWith(prefix));
}

export function fileParentIsVisible(
  folderPath: string | null,
  visibility: SearchVisibility,
): boolean {
  if (!folderPath) {
    return visibility.type === 'room';
  }

  return folderIsVisible(folderPath, visibility);
}

function mergeVisibility(
  left: SearchVisibility,
  right: SearchVisibility,
): SearchVisibility {
  if (left.type === 'room' || right.type === 'room') {
    return { type: 'room' };
  }

  return {
    type: 'restricted',
    folderPaths: unique(left.folderPaths.concat(right.folderPaths)),
    fileIds: unique(left.fileIds.concat(right.fileIds)),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
