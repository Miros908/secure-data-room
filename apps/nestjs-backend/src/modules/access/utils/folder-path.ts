export function parseFolderPath(path: string | null | undefined): string[] {
  if (!path) {
    return [];
  }

  return path.split('/').filter((segment) => segment.length > 0);
}

export function coveringFolderIds(subject: {
  folderId: string | null;
  folderPath: string | null;
}): string[] {
  const ids = new Set(parseFolderPath(subject.folderPath));

  if (subject.folderId) {
    ids.add(subject.folderId);
  }

  return [...ids];
}
