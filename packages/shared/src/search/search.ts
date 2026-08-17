import { z } from "zod";
import { effectiveRoleSchema } from "../access/subject";
import { folderBreadcrumbSchema } from "../folders/folder";

export const SEARCH_QUERY_MAX = 255;
export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_MAX_LIMIT = 50;

export const searchKindSchema = z.enum(["file", "folder"]);

export type SearchKind = z.infer<typeof searchKindSchema>;

export const searchDriveQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(SEARCH_QUERY_MAX),
    dataRoomId: z.uuid(),
    token: z.string().min(1).max(128).optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).optional(),
  })
  .strict();

export type SearchDriveQuery = z.infer<typeof searchDriveQuerySchema>;

const searchHitBaseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  parentId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  breadcrumbs: z.array(folderBreadcrumbSchema),
});

export const searchFolderHitSchema = searchHitBaseSchema.extend({
  kind: z.literal("folder"),
});

export const searchFileHitSchema = searchHitBaseSchema.extend({
  kind: z.literal("file"),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  versionCount: z.number().int().positive(),
});

export const searchHitSchema = z.discriminatedUnion("kind", [
  searchFolderHitSchema,
  searchFileHitSchema,
]);

export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchDriveResponseSchema = z.object({
  q: z.string(),
  dataRoomId: z.uuid(),
  role: effectiveRoleSchema,
  accessExpiresAt: z.iso.datetime().nullable(),
  items: z.array(searchHitSchema),
  nextCursor: z.string().nullable(),
});

export type SearchDriveResponse = z.infer<typeof searchDriveResponseSchema>;
