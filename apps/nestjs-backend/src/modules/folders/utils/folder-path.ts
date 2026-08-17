export function buildFolderPath(
  parentPath: string | null,
  folderId: string,
): string {
  if (!parentPath) {
    return `/${folderId}/`;
  }

  const prefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  return `${prefix}${folderId}/`;
}
