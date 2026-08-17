'use client';

import { useSearchParams } from 'next/navigation';
import { useMe } from '@/app/hooks/queries/use-me';
import { useRedirectUnauthorized } from '@/app/hooks/use-redirect-unauthorized';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/api-error-message';
import { useT } from '@/app/lib/i18n/use-t';
import { parseAccessSubject, parseDriveView, parseUuid } from './drive-location';
import { DriveLoading } from './drive-loading';
import { DriveShell } from './drive-shell';

export function DriveScreen() {
  const t = useT();
  const searchParams = useSearchParams();
  const me = useMe();
  useRedirectUnauthorized(me.error);

  if (me.isPending || me.error?.statusCode === 401) {
    return <DriveLoading />;
  }

  if (me.error || !me.data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <p role="alert" className="text-sm text-danger">
          {me.error ? apiErrorMessage(me.error) : t.drive.profileFailed}
        </p>
        <Button type="button" onClick={() => me.refetch()}>
          {t.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <DriveShell
      user={me.data}
      folderId={parseUuid(searchParams.get('folderId'))}
      dataRoomId={parseUuid(searchParams.get('dataRoomId'))}
      fileId={parseUuid(searchParams.get('fileId'))}
      view={parseDriveView(searchParams.get('view'))}
      access={parseAccessSubject(
        searchParams.get('accessType'),
        searchParams.get('accessId'),
      )}
    />
  );
}
