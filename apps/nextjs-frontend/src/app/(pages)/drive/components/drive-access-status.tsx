'use client';

import type { SharingSummary } from '@sdr/shared/access';
import { hasDirectSharing } from '@sdr/shared/access';
import { LinkIcon, PeopleIcon } from '@/components/ui/icons';
import { formatSharingStatus, inheritedLabel } from './drive-sharing-label';

type DriveAccessStatusProps = {
  sharing?: SharingSummary;
  onOpenDirect: () => void;
  onOpenInherited?: (source: NonNullable<SharingSummary['inheritedFrom']>) => void;
  compact?: boolean;
};

export function DriveAccessStatus({
  sharing,
  onOpenDirect,
  onOpenInherited,
  compact = false,
}: DriveAccessStatusProps) {
  if (!sharing) {
    return <span className="text-sm text-muted">—</span>;
  }

  const direct = hasDirectSharing(sharing);
  const inherited = sharing.inheritedFrom;

  if (!direct && !inherited) {
    return <span className="text-sm text-muted">—</span>;
  }

  const title = direct
    ? formatSharingStatus(sharing)
    : inherited
      ? inheritedLabel(inherited.type, inherited.name)
      : '';

  return (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (direct) {
          onOpenDirect();
          return;
        }
        if (inherited) {
          onOpenInherited?.(inherited);
        }
      }}
      className={
        compact
          ? 'inline-flex max-w-full items-center justify-end gap-1 rounded-md py-1 text-muted hover:bg-bg hover:text-fg'
          : 'inline-flex max-w-full items-center justify-end gap-1 rounded-md px-1.5 py-1 text-muted hover:bg-bg hover:text-fg'
      }
    >
      {sharing.hasPublicLink ? <LinkIcon className="h-3.5 w-3.5" /> : null}
      {sharing.peopleCount + sharing.pendingCount > 0 || inherited ? (
        <PeopleIcon className="h-3.5 w-3.5" filled={direct} />
      ) : null}
      {compact ? null : (
        <span className="hidden truncate text-xs lg:inline">{title}</span>
      )}
    </button>
  );
}
