import type {
  AccessSubjectType,
  InheritedShareLayer,
  SharingSummary,
} from '@sdr/shared/access';
import { hasDirectSharing } from '@sdr/shared/access';
import { getMessages } from '@/app/lib/i18n/get-messages';

export function formatPeopleCount(count: number): string {
  return getMessages().access.peopleCount(count);
}

export function formatSharingStatus(summary: SharingSummary): string {
  const t = getMessages();
  const parts: string[] = [];

  if (summary.hasPublicLink) {
    parts.push(t.access.linkWord);
  }

  const people = summary.peopleCount + summary.pendingCount;
  if (people > 0) {
    parts.push(formatPeopleCount(people));
  }

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  if (summary.inheritedFrom) {
    return inheritedLabel(summary.inheritedFrom.type, summary.inheritedFrom.name);
  }

  return t.access.noAccess;
}

export function inheritedLabel(
  type: AccessSubjectType,
  name: string,
): string {
  const t = getMessages();
  if (type === 'data_room') {
    return t.access.viaDrive;
  }

  return t.access.viaNamed(name);
}

export function coveredAncestorHint(
  email: string,
  inherited: InheritedShareLayer[],
): string | null {
  const needle = email.trim().toLowerCase();
  const layer = inherited.find(
    (item) =>
      item.grants.some((grant) => grant.email.toLowerCase() === needle) ||
      item.invitations.some((invite) => invite.email.toLowerCase() === needle),
  );

  if (!layer) {
    return null;
  }

  return getMessages().access.alreadyCoveredVia(
    inheritedLabel(layer.source.type, layer.source.name),
  );
}

export function accessToolbarLabel(summary: SharingSummary | undefined): string {
  const t = getMessages();
  if (!summary) {
    return t.access.toolbar;
  }

  if (hasDirectSharing(summary)) {
    return t.access.toolbarStatus(formatSharingStatus(summary));
  }

  if (summary.inheritedFrom) {
    return t.access.toolbarStatus(
      inheritedLabel(summary.inheritedFrom.type, summary.inheritedFrom.name),
    );
  }

  return t.access.toolbar;
}
