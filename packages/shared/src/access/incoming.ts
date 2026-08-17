import { z } from "zod";
import { grantRoleSchema } from "./subject";

export const incomingRoomShareSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: grantRoleSchema,
  accessExpiresAt: z.iso.datetime().nullable(),
});

export const incomingFolderShareSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  dataRoomId: z.uuid(),
  role: grantRoleSchema,
  accessExpiresAt: z.iso.datetime().nullable(),
});

export const incomingFileShareSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  dataRoomId: z.uuid(),
  role: grantRoleSchema,
  accessExpiresAt: z.iso.datetime().nullable(),
});

export const listIncomingSharesResponseSchema = z.object({
  rooms: z.array(incomingRoomShareSchema),
  folders: z.array(incomingFolderShareSchema),
  files: z.array(incomingFileShareSchema),
});

export type ListIncomingSharesResponse = z.infer<
  typeof listIncomingSharesResponseSchema
>;
