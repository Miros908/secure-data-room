import { z } from 'zod';
import {
  accessSubjectTypeSchema,
  type AccessSubjectType,
  type EffectiveRoleDto,
} from '@sdr/shared/access';

const uuidSchema = z.uuid();

export type DriveView = 'folder' | 'outgoing' | 'incoming' | 'activity';

export function isDriveSectionView(
  view: DriveView,
): view is Exclude<DriveView, 'folder'> {
  return view === 'outgoing' || view === 'incoming' || view === 'activity';
}

export type DriveAccessSubject = {
  type: AccessSubjectType;
  id: string;
};

export function parseUuid(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function parseDriveView(value: string | null | undefined): DriveView {
  if (value === 'outgoing' || value === 'incoming' || value === 'activity') {
    return value;
  }

  return 'folder';
}

export function parseAccessSubject(
  type: string | null | undefined,
  id: string | null | undefined,
): DriveAccessSubject | undefined {
  const parsedType = accessSubjectTypeSchema.safeParse(type);
  const parsedId = parseUuid(id);

  if (!parsedType.success || !parsedId) {
    return undefined;
  }

  return { type: parsedType.data, id: parsedId };
}

export function canWriteDrive(role: EffectiveRoleDto): boolean {
  return role === 'owner' || role === 'editor';
}

export function canShareDrive(role: EffectiveRoleDto): boolean {
  return role === 'owner';
}

export function driveHref(input: {
  folderId?: string;
  dataRoomId?: string;
  myRoomId?: string | null;
  fileId?: string;
  view?: DriveView;
  accessType?: AccessSubjectType;
  accessId?: string;
}): string {
  const params = new URLSearchParams();

  if (input.view && isDriveSectionView(input.view)) {
    params.set('view', input.view);
    if (input.view === 'outgoing') {
      appendAccess(params, input.accessType, input.accessId);
    }
    return `/drive?${params.toString()}`;
  }

  if (input.fileId && !input.folderId) {
    params.set('fileId', input.fileId);
    if (input.dataRoomId && input.dataRoomId !== input.myRoomId) {
      params.set('dataRoomId', input.dataRoomId);
    }
    return `/drive?${params.toString()}`;
  }

  if (input.folderId) {
    params.set('folderId', input.folderId);
    if (input.dataRoomId) {
      params.set('dataRoomId', input.dataRoomId);
    }
    if (input.fileId) {
      params.set('fileId', input.fileId);
    } else {
      appendAccess(params, input.accessType, input.accessId);
    }
    return `/drive?${params.toString()}`;
  }

  if (input.dataRoomId && input.dataRoomId !== input.myRoomId) {
    params.set('dataRoomId', input.dataRoomId);
    appendAccess(params, input.accessType, input.accessId);
    return `/drive?${params.toString()}`;
  }

  appendAccess(params, input.accessType, input.accessId);
  const query = params.toString();
  return query ? `/drive?${query}` : '/drive';
}

export function driveOpenInFolderHref(input: {
  type: AccessSubjectType;
  id: string;
  dataRoomId: string;
  parentFolderId: string | null;
  myRoomId?: string | null;
}): string {
  if (input.type === 'file') {
    return driveHref({
      folderId: input.parentFolderId ?? undefined,
      dataRoomId: input.dataRoomId,
      myRoomId: input.myRoomId,
      accessType: 'file',
      accessId: input.id,
    });
  }

  if (input.type === 'folder') {
    return driveHref({
      folderId: input.id,
      dataRoomId: input.dataRoomId,
      myRoomId: input.myRoomId,
      accessType: 'folder',
      accessId: input.id,
    });
  }

  return driveHref({
    dataRoomId: input.dataRoomId,
    myRoomId: input.myRoomId,
    accessType: 'data_room',
    accessId: input.id,
  });
}

function appendAccess(
  params: URLSearchParams,
  type?: AccessSubjectType,
  id?: string,
) {
  if (type && id) {
    params.set('accessType', type);
    params.set('accessId', id);
  }
}
