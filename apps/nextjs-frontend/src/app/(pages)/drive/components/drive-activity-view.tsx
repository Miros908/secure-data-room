'use client';

import { useMemo, useState } from 'react';
import type {
  ActivityEvent,
  ActivityTopFile,
  ActivityVisitor,
} from '@sdr/shared/activity';
import { useActivitySummary } from '@/app/hooks/queries/use-activity-summary';
import { useActivityTimeline } from '@/app/hooks/queries/use-activity-timeline';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cx } from '@/lib/cx';
import { useT } from '@/app/lib/i18n/use-t';
import {
  activityEventLabel,
  displayActorName,
} from './drive-activity-copy';
import { formatActivityTime } from './drive-format';
import { matchesDriveQuery } from './drive-sort';

type DriveActivityViewProps = {
  roomId?: string;
  search?: string;
};

export function DriveActivityView({
  roomId,
  search = '',
}: DriveActivityViewProps) {
  const t = useT();
  const [actorKey, setActorKey] = useState<string>();
  const summary = useActivitySummary(roomId);
  const timeline = useActivityTimeline(roomId, actorKey);
  const events = useMemo(
    () => timeline.data?.pages.flatMap((page) => page.events) ?? [],
    [timeline.data?.pages],
  );
  const visitors = useMemo(() => {
    const items = summary.data?.visitors ?? [];
    const query = search.trim();
    if (!query) {
      return items;
    }

    return items.filter(
      (visitor) =>
        matchesDriveQuery(visitor.actor.name, query) ||
        matchesDriveQuery(visitor.actor.email ?? '', query),
    );
  }, [search, summary.data?.visitors]);
  const topFiles = useMemo(() => {
    const items = summary.data?.topFiles ?? [];
    const query = search.trim();
    if (!query) {
      return items;
    }

    return items.filter((file) => matchesDriveQuery(file.name, query));
  }, [search, summary.data?.topFiles]);
  const visibleEvents = useMemo(() => {
    const query = search.trim();
    if (!query) {
      return events;
    }

    return events.filter(
      (event) =>
        matchesDriveQuery(event.actor.name, query) ||
        matchesDriveQuery(event.resourceName ?? '', query) ||
        matchesDriveQuery(activityEventLabel(event.type), query),
    );
  }, [events, search]);

  if (summary.error && summary.error.statusCode !== 401) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <p role="alert" className="text-sm text-danger">
          {apiErrorMessage(summary.error, {
            not_found: t.activity.ownerOnly,
          })}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void summary.refetch()}
        >
          {t.common.retry}
        </Button>
      </div>
    );
  }

  const empty =
    !summary.isPending &&
    (summary.data?.totals.uniqueVisitors ?? 0) === 0 &&
    (summary.data?.totals.views ?? 0) === 0 &&
    events.length === 0;

  return (
    <div
      data-testid="drive-activity"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6"
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg">
          {t.activity.title}
        </h1>
      </div>

      {summary.isPending ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-surface-muted" />
        </div>
      ) : empty ? (
        <p className="py-16 text-center text-sm text-muted">{t.empty.activity}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          <section aria-labelledby="activity-visitors-title">
            <h2
              id="activity-visitors-title"
              className="text-sm font-medium text-fg"
            >
              {t.activity.people}
            </h2>
            {visitors.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t.empty.nobodyFound}</p>
            ) : (
              <ul className="mt-3 flex flex-col">
                {visitors.map((visitor) => (
                  <VisitorRow
                    key={visitor.actor.key}
                    visitor={visitor}
                    active={actorKey === visitor.actor.key}
                    onSelect={() =>
                      setActorKey((current) =>
                        current === visitor.actor.key
                          ? undefined
                          : visitor.actor.key,
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="activity-files-title">
            <h2 id="activity-files-title" className="text-sm font-medium text-fg">
              {t.activity.files}
            </h2>
            {topFiles.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t.empty.noResults}</p>
            ) : (
              <ul className="mt-3 flex flex-col">
                {topFiles.map((file) => (
                  <TopFileRow key={file.fileId} file={file} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="activity-timeline-title">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="activity-timeline-title"
                className="text-sm font-medium text-fg"
              >
                {t.activity.log}
              </h2>
              {actorKey ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActorKey(undefined)}
                >
                  {t.common.all}
                </Button>
              ) : null}
            </div>
            {timeline.isPending ? (
              <div className="mt-3 space-y-2" aria-busy="true">
                <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
                <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
              </div>
            ) : visibleEvents.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t.empty.activity}</p>
            ) : (
              <>
                <ol className="mt-3 flex flex-col">
                  {visibleEvents.map((event) => (
                    <TimelineRow key={event.id} event={event} />
                  ))}
                </ol>
                {timeline.hasNextPage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3"
                    disabled={timeline.isFetchingNextPage}
                    onClick={() => void timeline.fetchNextPage()}
                  >
                    {t.activity.showMore}
                  </Button>
                ) : null}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function VisitorRow({
  visitor,
  active,
  onSelect,
}: {
  visitor: ActivityVisitor;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useT();

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cx(
          'flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm',
          active ? 'bg-surface-muted' : 'hover:bg-surface-muted',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-fg">
            {displayActorName(visitor.actor.name)}
          </span>
          <span className="block truncate text-xs text-muted">
            {visitor.actor.email ?? t.activity.publicLink}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-muted">
          <span className="block">
            {t.activity.counts(visitor.viewCount, visitor.downloadCount)}
          </span>
          <span className="block">
            {formatActivityTime(visitor.lastSeenAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

function TopFileRow({ file }: { file: ActivityTopFile }) {
  const t = useT();

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm">
      <span className="min-w-0 truncate text-fg">{file.name}</span>
      <span className="shrink-0 text-xs text-muted">
        {t.activity.counts(file.viewCount, file.downloadCount)}
      </span>
    </li>
  );
}

function TimelineRow({ event }: { event: ActivityEvent }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border px-2 py-2 last:border-0">
      <span className="min-w-0 text-sm">
        <span className="block text-fg">
          {activityEventLabel(event.type)}
          {event.resourceName ? ` · ${event.resourceName}` : ''}
        </span>
        <span className="block text-xs text-muted">
          {displayActorName(event.actor.name)}
        </span>
      </span>
      <time
        dateTime={event.createdAt}
        className="shrink-0 text-xs text-muted"
      >
        {formatActivityTime(event.createdAt)}
      </time>
    </li>
  );
}
