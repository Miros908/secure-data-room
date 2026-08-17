'use client';

import type { FolderContents } from '@sdr/shared/folders';
import Link from 'next/link';
import { formatBytes, formatDriveDate } from '@/app/(pages)/drive/components/drive-format';
import { matchesDriveQuery, sortDriveEntries } from '@/app/(pages)/drive/components/drive-sort';
import { FolderIcon, PdfIcon } from '@/components/ui/icons';
import { useT } from '@/app/lib/i18n/use-t';
import { shareHref } from './share-location';

type ShareItemListProps = {
  token: string;
  contents: FolderContents;
  query?: string;
};

export function ShareItemList({
  token,
  contents,
  query = '',
}: ShareItemListProps) {
  const t = useT();
  const folders = sortDriveEntries(
    contents.folders.filter((folder) => matchesDriveQuery(folder.name, query)),
    'name',
    'asc',
  );
  const files = sortDriveEntries(
    contents.files.filter((file) => matchesDriveQuery(file.name, query)),
    'name',
    'asc',
  );

  return (
    <div className="min-w-0">
      <table className="w-full border-collapse">
        <thead className="text-xs font-normal text-muted">
          <tr className="hidden sm:table-row">
            <th className="min-w-0 px-3 py-1.5 text-left font-normal">{t.drive.name}</th>
            <th className="hidden w-[1%] px-3 py-1.5 text-right font-normal whitespace-nowrap sm:table-cell">
              {t.drive.size}
            </th>
            <th className="hidden w-[1%] px-3 py-1.5 text-right font-normal whitespace-nowrap sm:table-cell">
              {t.drive.date}
            </th>
          </tr>
        </thead>
        <tbody>
          {folders.map((folder) => (
            <tr key={folder.id} className="hover:bg-surface-muted">
              <td className="min-w-0 px-3 py-2.5">
                <Link
                  href={shareHref({ token, folderId: folder.id })}
                  className="flex min-w-0 items-center gap-3"
                >
                  <FolderIcon className="h-5 w-5 shrink-0 text-folder" />
                  <span className="truncate text-sm font-medium text-fg" title={folder.name}>
                    {folder.name}
                  </span>
                </Link>
              </td>
              <td className="hidden w-[1%] px-3 py-2.5 text-right text-sm text-muted whitespace-nowrap sm:table-cell">
                —
              </td>
              <td className="hidden w-[1%] px-3 py-2.5 text-right whitespace-nowrap sm:table-cell">
                <time className="text-sm text-muted" dateTime={folder.createdAt}>
                  {formatDriveDate(folder.createdAt)}
                </time>
              </td>
            </tr>
          ))}
          {files.map((file) => (
            <tr key={file.id} className="hover:bg-surface-muted">
              <td className="min-w-0 px-3 py-2.5">
                <Link
                  href={shareHref({
                    token,
                    folderId: contents.folder?.id,
                    fileId: file.id,
                  })}
                  scroll={false}
                  className="flex min-w-0 w-full cursor-pointer items-center gap-3 text-left"
                >
                  <PdfIcon className="h-5 w-5 shrink-0" />
                  <span className="truncate text-sm text-fg" title={file.name}>
                    {file.name}
                  </span>
                </Link>
              </td>
              <td className="hidden w-[1%] px-3 py-2.5 text-right text-sm text-muted whitespace-nowrap sm:table-cell">
                {formatBytes(file.sizeBytes)}
              </td>
              <td className="hidden w-[1%] px-3 py-2.5 text-right whitespace-nowrap sm:table-cell">
                <time className="text-sm text-muted" dateTime={file.createdAt}>
                  {formatDriveDate(file.createdAt)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
