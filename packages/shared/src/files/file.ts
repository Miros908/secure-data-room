import { z } from "zod";
import { effectiveRoleSchema, shareTokenQuerySchema } from "../access/subject";

export const fileNameSchema = z.string().trim().min(1).max(255);

export const uploadFileFieldsSchema = z
  .object({
    dataRoomId: z.uuid(),
    folderId: z.uuid().optional(),
    name: fileNameSchema.optional(),
  })
  .strict();

export type UploadFileFieldsDto = z.infer<typeof uploadFileFieldsSchema>;

export const renameFileSchema = z
  .object({
    name: fileNameSchema,
  })
  .strict();

export type RenameFileDto = z.infer<typeof renameFileSchema>;

export const moveFileSchema = z
  .object({
    folderId: z.uuid().nullable(),
  })
  .strict();

export type MoveFileDto = z.infer<typeof moveFileSchema>;

export const fileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  dataRoomId: z.uuid(),
  folderId: z.uuid().nullable(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  versionNumber: z.number().int().positive(),
  versionCount: z.number().int().positive(),
  isNewVersion: z.boolean().optional(),
  createdAt: z.iso.datetime(),
});

export type FileDto = z.infer<typeof fileSchema>;

export const fileDetailSchema = fileSchema.extend({
  currentVersionId: z.uuid(),
  role: effectiveRoleSchema,
  accessExpiresAt: z.iso.datetime().nullable(),
  downloadUrl: z.string(),
  downloadUrlExpiresAt: z.iso.datetime(),
});

export type FileDetail = z.infer<typeof fileDetailSchema>;

export const fileVersionItemSchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int().positive(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  uploadedByName: z.string(),
});

export type FileVersionItem = z.infer<typeof fileVersionItemSchema>;

export const fileVersionListSchema = z.object({
  versions: z.array(fileVersionItemSchema),
});

export type FileVersionList = z.infer<typeof fileVersionListSchema>;

export const getFileQuerySchema = shareTokenQuerySchema;

export type GetFileQuery = z.infer<typeof getFileQuerySchema>;

export const uploadTicketResponseSchema = z.object({
  ticket: z.string().min(1),
  expiresAt: z.iso.datetime(),
});

export type UploadTicketResponse = z.infer<typeof uploadTicketResponseSchema>;
