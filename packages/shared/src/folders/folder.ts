import { z } from "zod";
import { sharingSummarySchema } from "../access/sharing-summary";
import { effectiveRoleSchema, shareTokenQuerySchema } from "../access/subject";

export const folderNameSchema = z.string().trim().min(1).max(255);

export const createFolderSchema = z
  .object({
    name: folderNameSchema,
    parentId: z.uuid().optional(),
    dataRoomId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (value) => value.parentId !== undefined || value.dataRoomId !== undefined,
    {
      message: "parent_or_data_room_required",
    },
  );

export type CreateFolderDto = z.infer<typeof createFolderSchema>;

export const renameFolderSchema = z
  .object({
    name: folderNameSchema,
  })
  .strict();

export type RenameFolderDto = z.infer<typeof renameFolderSchema>;

export const folderSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  parentId: z.uuid().nullable(),
  dataRoomId: z.uuid(),
  createdAt: z.iso.datetime(),
});

export type Folder = z.infer<typeof folderSchema>;

export const folderChildSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  sharing: sharingSummarySchema.optional(),
});

export const folderFileChildSchema = folderChildSchema.extend({
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string(),
  versionCount: z.number().int().positive(),
});

export const folderBreadcrumbSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export const folderContentsSchema = z.object({
  folder: folderSchema.nullable(),
  dataRoomId: z.uuid(),
  role: effectiveRoleSchema,
  accessExpiresAt: z.iso.datetime().nullable(),
  breadcrumbs: z.array(folderBreadcrumbSchema),
  folders: z.array(folderChildSchema),
  files: z.array(folderFileChildSchema),
  sharing: sharingSummarySchema.optional(),
});

export type FolderContents = z.infer<typeof folderContentsSchema>;

export const listRootFolderQuerySchema = z
  .object({
    dataRoomId: z.uuid(),
    token: z.string().min(1).max(128).optional(),
  })
  .strict();

export type ListRootFolderQuery = z.infer<typeof listRootFolderQuerySchema>;

export const getFolderQuerySchema = shareTokenQuerySchema;

export type GetFolderQuery = z.infer<typeof getFolderQuerySchema>;

export const deleteFolderResponseSchema = z.object({
  ok: z.literal(true),
  deletedFolders: z.number().int().nonnegative(),
  deletedFiles: z.number().int().nonnegative(),
});

export type DeleteFolderResponse = z.infer<typeof deleteFolderResponseSchema>;
