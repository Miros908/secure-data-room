import { z } from "zod";

export const GUEST_ACTIVITY_NAME = "Гость по ссылке";

export const activityEventTypeSchema = z.enum([
  "file_viewed",
  "file_downloaded",
  "link_opened",
  "access_granted",
  "access_revoked",
  "file_deleted",
  "folder_deleted",
]);

export type ActivityEventTypeDto = z.infer<typeof activityEventTypeSchema>;

export const activityActorKindSchema = z.enum(["user", "guest"]);

export type ActivityActorKind = z.infer<typeof activityActorKindSchema>;

export const activityActorSchema = z.object({
  key: z.string().min(1).max(80),
  kind: activityActorKindSchema,
  name: z.string(),
  email: z.string().nullable(),
});

export type ActivityActor = z.infer<typeof activityActorSchema>;

export const activityEventSchema = z.object({
  id: z.uuid(),
  type: activityEventTypeSchema,
  createdAt: z.iso.datetime(),
  actor: activityActorSchema,
  fileId: z.uuid().nullable(),
  folderId: z.uuid().nullable(),
  resourceName: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const activityVisitorSchema = z.object({
  actor: activityActorSchema,
  viewCount: z.number().int().nonnegative(),
  downloadCount: z.number().int().nonnegative(),
  lastSeenAt: z.iso.datetime(),
  firstSeenAt: z.iso.datetime(),
});

export type ActivityVisitor = z.infer<typeof activityVisitorSchema>;

export const activityTopFileSchema = z.object({
  fileId: z.uuid(),
  name: z.string(),
  viewCount: z.number().int().nonnegative(),
  downloadCount: z.number().int().nonnegative(),
  lastViewedAt: z.iso.datetime().nullable(),
});

export type ActivityTopFile = z.infer<typeof activityTopFileSchema>;

export const activitySummarySchema = z.object({
  visitors: z.array(activityVisitorSchema),
  topFiles: z.array(activityTopFileSchema),
  totals: z.object({
    views: z.number().int().nonnegative(),
    downloads: z.number().int().nonnegative(),
    uniqueVisitors: z.number().int().nonnegative(),
    linkOpens: z.number().int().nonnegative(),
  }),
});

export type ActivitySummary = z.infer<typeof activitySummarySchema>;

export const activityTimelineQuerySchema = z
  .object({
    cursor: z.string().min(1).max(256).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    actorKey: z.string().min(1).max(80).optional(),
    type: activityEventTypeSchema.optional(),
  })
  .strict();

export type ActivityTimelineQuery = z.infer<typeof activityTimelineQuerySchema>;

export const activityTimelineSchema = z.object({
  events: z.array(activityEventSchema),
  nextCursor: z.string().nullable(),
});

export type ActivityTimeline = z.infer<typeof activityTimelineSchema>;

export const recordFileActivityQuerySchema = z
  .object({
    token: z.string().min(1).max(128).optional(),
    versionId: z.uuid().optional(),
  })
  .strict();

export type RecordFileActivityQuery = z.infer<
  typeof recordFileActivityQuerySchema
>;

export const recordFileViewResponseSchema = z.object({
  ok: z.literal(true),
});

export type RecordFileViewResponse = z.infer<
  typeof recordFileViewResponseSchema
>;

export const recordFileDownloadResponseSchema = z.object({
  downloadUrl: z.string(),
  downloadUrlExpiresAt: z.iso.datetime(),
});

export type RecordFileDownloadResponse = z.infer<
  typeof recordFileDownloadResponseSchema
>;
