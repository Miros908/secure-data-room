'use client';

import type { LiveEvent } from '@sdr/shared/events';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { connectLiveEvents } from '@/app/lib/connect-live-events';
import { liveEventsUrl } from '@/app/lib/live-events-url';
import { accessQueryKeys } from '@/app/lib/access.query-keys';
import { activityQueryKeys } from '@/app/lib/activity.query-keys';
import { dataRoomsQueryKeys } from '@/app/lib/data-rooms.query-keys';
import { filesQueryKeys } from '@/app/lib/files.query-keys';
import { foldersQueryKeys } from '@/app/lib/folders.query-keys';
import { searchQueryKeys } from '@/app/lib/search.query-keys';
import { LiveAccessNoticeProvider } from './use-live-notice';

type LiveAccessGateProps = {
  token?: string;
  dataRoomId?: string;
  folderId?: string;
  fileId?: string;
  children: ReactNode;
};

export function LiveAccessGate({
  token,
  dataRoomId,
  folderId,
  fileId,
  children,
}: LiveAccessGateProps) {
  const [notice, setNotice] = useState<LiveEvent | null>(null);
  const queryClient = useQueryClient();
  const enabled = Boolean(token || dataRoomId);
  const viewRef = useRef({ dataRoomId, fileId, folderId, token });
  viewRef.current = { dataRoomId, fileId, folderId, token };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const invalidate = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: filesQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: foldersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: searchQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: accessQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: dataRoomsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: activityQueryKeys.all }),
      ]);

    const session = connectLiveEvents({
      url: liveEventsUrl({ token, dataRoomId }),
      onGap: () => {
        void invalidate();
      },
      onLinkGone: () => {
        void invalidate();
      },
      onAuthLost: () => {
        void invalidate();
      },
      onEvent: (event) => {
        const view = viewRef.current;
        const applies = liveEventApplies({ event, ...view });

        if (event.type === 'activity_recorded') {
          if (applies) {
            void invalidate();
          }
          return;
        }

        if (event.type === 'access_granted') {
          void invalidate().then(() => {
            if (applies) {
              setNotice(null);
            }
          });
          return;
        }

        if (applies) {
          setNotice(event);
        }

        void invalidate().then(() => {
          if (!applies || event.type !== 'access_invalidated') {
            return;
          }

          const fileState = view.fileId
            ? queryClient.getQueryState(
                filesQueryKeys.detail(view.fileId, view.token),
              )
            : null;
          const listingState = queryClient.getQueryState(
            foldersQueryKeys.contents({
              folderId: view.folderId,
              dataRoomId: view.folderId ? undefined : view.dataRoomId,
              token: view.token,
            }),
          );
          const linkState = view.token
            ? queryClient.getQueryState(accessQueryKeys.publicLink(view.token))
            : null;
          const fileOk = !view.fileId || fileState?.status === 'success';
          const listingOk =
            Boolean(view.fileId) || listingState?.status === 'success';
          const linkOk = !view.token || linkState?.status === 'success';
          if (fileOk && listingOk && linkOk) {
            setNotice(null);
          }
        });
      },
    });

    return () => session.close();
  }, [dataRoomId, enabled, queryClient, token]);

  return (
    <LiveAccessNoticeProvider notice={notice}>
      {children}
    </LiveAccessNoticeProvider>
  );
}

export function liveEventApplies(input: {
  event: LiveEvent;
  dataRoomId?: string;
  fileId?: string;
  folderId?: string;
}): boolean {
  if (input.event.type === 'activity_recorded') {
    return !input.dataRoomId || input.event.dataRoomId === input.dataRoomId;
  }

  const target =
    input.event.type === 'resource_gone'
      ? input.event.subject
      : input.event.target;

  if (input.fileId && target.kind === 'file' && target.id === input.fileId) {
    return true;
  }

  if (
    input.folderId &&
    target.kind === 'folder' &&
    target.id === input.folderId
  ) {
    return true;
  }

  if (input.dataRoomId && input.event.dataRoomId !== input.dataRoomId) {
    return false;
  }

  return true;
}
