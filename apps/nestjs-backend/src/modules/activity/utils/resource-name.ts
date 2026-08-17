import type { AccessRepository } from '../../access/access.repository';
import type { AccessTarget } from '../../access/utils/subject-target';

export async function activityResourceName(
  access: Pick<
    AccessRepository,
    'findFilesMeta' | 'findFoldersMeta' | 'findDataRooms'
  >,
  target: AccessTarget,
): Promise<string | null> {
  if (target.fileId) {
    return (await access.findFilesMeta([target.fileId]))[0]?.name ?? null;
  }

  if (target.folderId) {
    return (await access.findFoldersMeta([target.folderId]))[0]?.name ?? null;
  }

  return (await access.findDataRooms([target.dataRoomId]))[0]?.name ?? null;
}
