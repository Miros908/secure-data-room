import { z } from "zod";
import { accessSubjectTypeSchema } from "./subject";
import { shareSourceSchema } from "./sharing-summary";

export const outgoingShareItemSchema = z.object({
  type: accessSubjectTypeSchema,
  id: z.uuid(),
  name: z.string(),
  dataRoomId: z.uuid(),
  parentFolderId: z.uuid().nullable(),
  path: z.array(shareSourceSchema.pick({ id: true, name: true })),
  peopleCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  hasPublicLink: z.boolean(),
});

export type OutgoingShareItem = z.infer<typeof outgoingShareItemSchema>;

export const listOutgoingSharesResponseSchema = z.object({
  items: z.array(outgoingShareItemSchema),
});

export type ListOutgoingSharesResponse = z.infer<
  typeof listOutgoingSharesResponseSchema
>;
