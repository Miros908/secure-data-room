'use client';

import type { FileVersionItem } from '@sdr/shared/files';
import {
  formatActivityTime,
  formatBytes,
} from '@/app/(pages)/drive/components/drive-format';
import { Button } from '@/components/ui/button';
import { CheckIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { useT } from '@/app/lib/i18n/use-t';

export type FileVersionHistoryTone = 'surface' | 'viewer';

type FileVersionHistoryBase = {
  versions: FileVersionItem[];
  currentVersionId: string;
  tone?: FileVersionHistoryTone;
  labelledBy?: string;
  id?: string;
};

type FileVersionHistoryProps = FileVersionHistoryBase &
  (
    | {
        onSelect: (versionId: string) => void;
        selectedVersionId: string;
        onOpen?: never;
      }
    | {
        onOpen: (versionId: string) => void;
        onSelect?: never;
        selectedVersionId?: never;
      }
  );

const TONE: Record<
  FileVersionHistoryTone,
  { option: string; selected: string; meta: string; badge: string }
> = {
  surface: {
    option: 'text-fg hover:bg-surface-muted',
    selected: 'bg-accent/10',
    meta: 'text-muted',
    badge: 'bg-accent/12 text-accent',
  },
  viewer: {
    option: 'text-viewer-fg hover:bg-white/10',
    selected: 'bg-white/10',
    meta: 'text-viewer-muted',
    badge: 'bg-white/15 text-viewer-fg',
  },
};

function VersionMeta({
  version,
  current,
  metaClass,
  badgeClass,
}: {
  version: FileVersionItem;
  current: boolean;
  metaClass: string;
  badgeClass: string;
}) {
  const t = useT();

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-medium">
          {t.drive.versionN(version.versionNumber)}
        </span>
        {current ? (
          <span
            className={cx(
              'rounded-full px-1.5 py-px text-[10px] font-medium tracking-wide uppercase',
              badgeClass,
            )}
          >
            {t.common.current}
          </span>
        ) : null}
      </span>
      <span className={cx('truncate text-xs', metaClass)}>
        {formatActivityTime(version.createdAt)}
        {version.uploadedByName ? ` · ${version.uploadedByName}` : ''}
        {' · '}
        {formatBytes(version.sizeBytes)}
      </span>
    </span>
  );
}

export function FileVersionHistory({
  versions,
  currentVersionId,
  tone = 'surface',
  labelledBy,
  id,
  ...mode
}: FileVersionHistoryProps) {
  const t = useT();
  const colors = TONE[tone];

  if ('onOpen' in mode && mode.onOpen) {
    const onOpen = mode.onOpen;
    return (
      <ul id={id} className="divide-y divide-border">
        {versions.map((version) => (
          <li key={version.id} className="flex items-center gap-2 px-3 py-2">
            <VersionMeta
              version={version}
              current={version.id === currentVersionId}
              metaClass={colors.meta}
              badgeClass={colors.badge}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t.drive.openVersion(version.versionNumber)}
              onClick={() => onOpen(version.id)}
            >
              {t.common.open}
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  const onSelect = mode.onSelect;
  const selectedVersionId = mode.selectedVersionId;

  return (
    <div id={id} role="listbox" aria-labelledby={labelledBy} className="py-1">
      {versions.map((version) => {
        const selected = version.id === selectedVersionId;
        return (
          <button
            key={version.id}
            type="button"
            role="option"
            aria-selected={selected}
            className={cx(
              'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
              colors.option,
              selected && colors.selected,
            )}
            onClick={() => onSelect(version.id)}
          >
            <VersionMeta
              version={version}
              current={version.id === currentVersionId}
              metaClass={colors.meta}
              badgeClass={colors.badge}
            />
            {selected ? (
              <CheckIcon className={cx('mt-0.5 h-4 w-4 shrink-0', colors.meta)} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
