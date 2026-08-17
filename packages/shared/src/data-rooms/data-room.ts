import { z } from "zod";
import { effectiveRoleSchema, shareTokenQuerySchema } from "../access/subject";

export const dataRoomSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: effectiveRoleSchema,
  accessExpiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type DataRoom = z.infer<typeof dataRoomSchema>;

export const listDataRoomsResponseSchema = z.object({
  myRoom: dataRoomSchema.nullable(),
  sharedRooms: z.array(dataRoomSchema),
});

export type ListDataRoomsResponse = z.infer<typeof listDataRoomsResponseSchema>;

export const getDataRoomQuerySchema = shareTokenQuerySchema;

export type GetDataRoomQuery = z.infer<typeof getDataRoomQuerySchema>;
