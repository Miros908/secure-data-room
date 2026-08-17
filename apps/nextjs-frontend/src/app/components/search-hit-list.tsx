'use client';

import type { SearchHit } from '@sdr/shared/search';
import Link from 'next/link';
import { FolderIcon, PdfIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { useT } from '@/app/lib/i18n/use-t';
import { formatBytes, formatDriveDate } from '@/app/(pages)/drive/components/drive-format';

type SearchHitListProps = {
  items: SearchHit[];
  folderHref: (hit: Extract<SearchHit, { kind: 'folder' }>) => string;
  fileHref: (hit: Extract<SearchHit, { kind: 'file' }>) => string;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

export function SearchHitList({
  items,
  folderHref,
  fileHref,
  isLoading = false,
  errorMessage,
  onRetry,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: SearchHitListProps) {
  const t = useT();

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
        {onRetry ? (
          <Button type="button" variant="ghost" onClick={onRetry}>
            {t.common.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  if (isLoading) {
    return (
      <p role="status" className="px-6 py-20 text-center text-sm text-muted">
        {t.search.searching}
      </p>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0">
      <table className="w-full border-collapse">
        <thead className="text-xs font-normal text-muted">
          <tr className="hidden sm:table-row">
            <th className="min-w-0 px-3 py-1.5 text-left font-normal">
              {t.drive.name}
            </th>
            <th className="hidden w-[1%] px-3 py-1.5 text-right font-normal whitespace-nowrap sm:table-cell">
              {t.drive.size}
            </th>
            <th className="hidden w-[1%] px-3 py-1.5 text-right font-normal whitespace-nowrap sm:table-cell">
              {t.drive.date}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((hit) =>
            hit.kind === 'folder' ? (
              <tr key={`folder:${hit.id}`} className="hover:bg-surface-muted">
                <td className="min-w-0 px-3 py-2.5">
                  <Link
                    href={folderHref(hit)}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <FolderIcon className="h-5 w-5 shrink-0 text-folder" />
                    <HitLabel name={hit.name} breadcrumbs={hit.breadcrumbs} />
                  </Link>
                </td>
                <td className="hidden w-[1%] px-3 py-2.5 text-right text-sm text-muted whitespace-nowrap sm:table-cell">
                  —
                </td>
                <td className="hidden w-[1%] px-3 py-2.5 text-right whitespace-nowrap sm:table-cell">
                  <time className="text-sm text-muted" dateTime={hit.createdAt}>
                    {formatDriveDate(hit.createdAt)}
                  </time>
                </td>
              </tr>
            ) : (
              <tr key={`file:${hit.id}`} className="hover:bg-surface-muted">
                <td className="min-w-0 px-3 py-2.5">
                  <Link
                    href={fileHref(hit)}
                    scroll={false}
                    className="flex min-w-0 w-full items-center gap-3 text-left"
                  >
                    <PdfIcon className="h-5 w-5 shrink-0" />
                    <HitLabel name={hit.name} breadcrumbs={hit.breadcrumbs} />
                  </Link>
                </td>
                <td className="hidden w-[1%] px-3 py-2.5 text-right text-sm text-muted whitespace-nowrap sm:table-cell">
                  {formatBytes(hit.sizeBytes)}
                </td>
                <td className="hidden w-[1%] px-3 py-2.5 text-right whitespace-nowrap sm:table-cell">
                  <time className="text-sm text-muted" dateTime={hit.createdAt}>
                    {formatDriveDate(hit.createdAt)}
                  </time>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {hasMore && onLoadMore ? (
        <div className="flex justify-center py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? t.common.loading : t.search.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function HitLabel({
  name,
  breadcrumbs,
}: {
  name: string;
  breadcrumbs: Array<{ id: string; name: string }>;
}) {
  const path = breadcrumbs.map((crumb) => crumb.name).join(' / ');

  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-fg" title={name}>
        {name}
      </span>
      {path ? (
        <span className="block truncate text-xs text-muted" title={path}>
          {path}
        </span>
      ) : null}
    </span>
  );
}
