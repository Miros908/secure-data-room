import { type ShareSource, type SharingSummary } from '@sdr/shared/access';
import { parseFolderPath } from './folder-path';

export type ShareCoverage = {
  peopleCount: number;
  pendingCount: number;
  hasPublicLink: boolean;
};

export type ShareAncestor = {
  type: 'data_room' | 'folder';
  id: string;
  name: string;
  dataRoomId: string;
};

export function shareTargetKey(input: {
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
}): string {
  if (input.fileId) {
    return `file:${input.fileId}`;
  }

  if (input.folderId) {
    return `folder:${input.folderId}`;
  }

  return `data_room:${input.dataRoomId}`;
}

export function ancestorKey(ancestor: ShareAncestor): string {
  return ancestor.type === 'data_room'
    ? `data_room:${ancestor.id}`
    : `folder:${ancestor.id}`;
}

export function hasCoverage(coverage: ShareCoverage | undefined): boolean {
  if (!coverage) {
    return false;
  }

  return (
    coverage.peopleCount > 0 ||
    coverage.pendingCount > 0 ||
    coverage.hasPublicLink
  );
}

export function nearestCoveringSource(
  ancestorsNearestFirst: ShareAncestor[],
  coverageByKey: Map<string, ShareCoverage>,
): ShareSource | null {
  for (const ancestor of ancestorsNearestFirst) {
    if (hasCoverage(coverageByKey.get(ancestorKey(ancestor)))) {
      return ancestor;
    }
  }

  return null;
}

export function toSharingSummary(
  coverage: ShareCoverage | undefined,
  inheritedFrom: ShareSource | null,
): SharingSummary {
  return {
    peopleCount: coverage?.peopleCount ?? 0,
    pendingCount: coverage?.pendingCount ?? 0,
    hasPublicLink: coverage?.hasPublicLink ?? false,
    inheritedFrom,
  };
}

export function inheritedFolderIds(input: {
  type: 'data_room' | 'folder' | 'file';
  folderId: string | null;
  folderPath: string | null;
}): string[] {
  const ids = parseFolderPath(input.folderPath);

  if (input.type === 'folder' && input.folderId) {
    return ids.filter((id) => id !== input.folderId);
  }

  if (
    input.type === 'file' &&
    input.folderId &&
    !ids.includes(input.folderId)
  ) {
    ids.push(input.folderId);
  }

  return ids;
}

export function ancestorCoveringQuery(subject: {
  type: 'data_room' | 'folder' | 'file';
  dataRoomId: string;
  folderId: string | null;
  folderPath: string | null;
}): { dataRoomId: string; folderIds: string[] } | null {
  if (subject.type === 'data_room') {
    return null;
  }

  return {
    dataRoomId: subject.dataRoomId,
    folderIds: inheritedFolderIds(subject),
  };
}

export function inheritedAncestorChain(input: {
  dataRoomId: string;
  dataRoomName: string;
  ancestorFolders: Array<{ id: string; name: string }>;
}): ShareAncestor[] {
  return [
    ...[...input.ancestorFolders].reverse().map((folder) => ({
      type: 'folder' as const,
      id: folder.id,
      name: folder.name,
      dataRoomId: input.dataRoomId,
    })),
    {
      type: 'data_room',
      id: input.dataRoomId,
      name: input.dataRoomName,
      dataRoomId: input.dataRoomId,
    },
  ];
}

export function childAncestorChain(input: {
  dataRoomId: string;
  dataRoomName: string;
  currentFolder: { id: string; name: string } | null;
  ancestorFolders: Array<{ id: string; name: string }>;
}): ShareAncestor[] {
  const inherited = inheritedAncestorChain({
    dataRoomId: input.dataRoomId,
    dataRoomName: input.dataRoomName,
    ancestorFolders: input.ancestorFolders,
  });

  if (!input.currentFolder) {
    return inherited;
  }

  return [
    {
      type: 'folder',
      id: input.currentFolder.id,
      name: input.currentFolder.name,
      dataRoomId: input.dataRoomId,
    },
    ...inherited,
  ];
}
