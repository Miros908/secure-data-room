import type { LiveEvent } from '@sdr/shared/events';
import type { AccessTarget } from './subject-target';
import { toSubjectRef } from './subject-target';

export function accessGrantedEvent(target: AccessTarget): LiveEvent {
  const { type, subjectId } = toSubjectRef(target);
  return {
    type: 'access_granted',
    dataRoomId: target.dataRoomId,
    target: { kind: type, id: subjectId },
  };
}
