import type { AccessSubject } from '../access.types';

export type AccessTarget = {
  dataRoomId: string;
  folderId: string | null;
  fileId: string | null;
};

export function toAccessTarget(subject: AccessSubject): AccessTarget {
  return {
    dataRoomId: subject.dataRoomId,
    folderId: subject.type === 'folder' ? subject.id : null,
    fileId: subject.type === 'file' ? subject.id : null,
  };
}

export function toSubjectRef(target: AccessTarget): {
  type: AccessSubject['type'];
  subjectId: string;
} {
  if (target.fileId) {
    return { type: 'file', subjectId: target.fileId };
  }

  if (target.folderId) {
    return { type: 'folder', subjectId: target.folderId };
  }

  return { type: 'data_room', subjectId: target.dataRoomId };
}
