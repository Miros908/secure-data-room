import type { ActivityEventTypeDto } from '@sdr/shared/activity';
import { GUEST_ACTIVITY_NAME } from '@sdr/shared/activity';
import { getMessages } from '@/app/lib/i18n/get-messages';

export function activityEventLabel(type: ActivityEventTypeDto): string {
  return getMessages().activity.events[type];
}

export function displayActorName(name: string): string {
  if (name === GUEST_ACTIVITY_NAME) {
    return getMessages().activity.linkVisitor;
  }

  return name;
}
