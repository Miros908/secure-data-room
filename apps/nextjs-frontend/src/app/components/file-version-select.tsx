'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FileDetail } from '@sdr/shared/files';
import { FileVersionHistory } from '@/app/components/file-version-history';
import { useFileVersion } from '@/app/hooks/queries/use-file-version';
import { useFileVersions } from '@/app/hooks/queries/use-file-versions';
import { ChevronDownIcon, HistoryIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';

const PANEL_WIDTH = 288;

type FileVersionSelectProps = {
  file: FileDetail;
  token?: string;
  selectedVersionId: string | undefined;
  onSelect: (versionId: string) => void;
};

export function FileVersionSelect({
  file,
  token,
  selectedVersionId,
  onSelect,
}: FileVersionSelectProps) {
  const t = useT();
  const versionsQuery = useFileVersions(file.id, token, file.versionCount > 1);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, ready: false });
  const triggerId = useId();
  const listId = useId();

  const versions = versionsQuery.data?.versions ?? [
    {
      id: file.currentVersionId,
      versionNumber: file.versionNumber,
      createdAt: file.createdAt,
      sizeBytes: file.sizeBytes,
      uploadedByName: '',
    },
  ];
  const value = selectedVersionId ?? file.currentVersionId;
  const selected = versions.find((version) => version.id === value);
  const shownNumber = selected?.versionNumber ?? file.versionNumber;

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const height = menuRef.current?.offsetHeight ?? 220;
    let left = rect.right - PANEL_WIDTH;
    left = Math.min(Math.max(8, left), window.innerWidth - PANEL_WIDTH - 8);
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 4);
    }
    setCoords({ top, left, ready: true });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    place();
  }, [open, versions.length, place]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  if (file.versionCount <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <div ref={triggerRef}>
        <button
          type="button"
          id={triggerId}
          aria-label={t.drive.fileVersion}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className="inline-flex h-9 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-viewer-fg hover:bg-white/10"
          onClick={() => setOpen((current) => !current)}
        >
          <HistoryIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">v{shownNumber}</span>
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
      </div>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[80] overflow-hidden rounded-lg border border-white/10 bg-viewer-bar shadow-[0_16px_40px_rgb(0_0_0/0.45)]"
              style={{
                top: coords.top,
                left: coords.left,
                width: PANEL_WIDTH,
                visibility: coords.ready ? 'visible' : 'hidden',
              }}
            >
              <p className="px-3 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-viewer-muted uppercase">
                {t.drive.versionHistory}
              </p>
              {versionsQuery.isPending ? (
                <p className="px-3 py-2 text-sm text-viewer-muted">{t.common.loading}</p>
              ) : (
                <div className="max-h-[min(24rem,calc(100vh-2rem))] overflow-y-auto">
                  <FileVersionHistory
                    id={listId}
                    labelledBy={triggerId}
                    versions={versions}
                    currentVersionId={file.currentVersionId}
                    selectedVersionId={value}
                    tone="viewer"
                    onSelect={(versionId) => {
                      setOpen(false);
                      onSelect(versionId);
                    }}
                  />
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function FilePreviousVersionNotice({
  visible,
  onShowCurrent,
}: {
  visible: boolean;
  onShowCurrent: () => void;
}) {
  const t = useT();

  if (!visible) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-3 py-1.5">
      <p className="text-xs text-viewer-muted">{t.drive.previousVersion}</p>
      <button
        type="button"
        className="text-xs font-medium text-viewer-fg hover:underline"
        onClick={onShowCurrent}
      >
        {t.drive.showCurrentVersion}
      </button>
    </div>
  );
}

export function useSelectedFileVersion(
  file: FileDetail | undefined,
  token?: string,
  initialVersionId?: string,
) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(
    initialVersionId,
  );
  const selected = selectedVersionId ?? file?.currentVersionId;
  const isCurrent = !file || !selected || selected === file.currentVersionId;
  const versionQuery = useFileVersion(file?.id, selected, token, !isCurrent);

  return {
    selectedVersionId: selected,
    setSelectedVersionId,
    downloadUrl: isCurrent ? file?.downloadUrl : versionQuery.data?.downloadUrl,
    downloadUrlExpiresAt: isCurrent
      ? file?.downloadUrlExpiresAt
      : versionQuery.data?.downloadUrlExpiresAt,
    isVersionPending: !isCurrent && versionQuery.isPending,
    isCurrent,
  };
}
