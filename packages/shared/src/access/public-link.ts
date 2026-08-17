import { z } from "zod";
import { accessSubjectTypeSchema } from "./subject";

export const createPublicLinkSchema = z
  .object({
    type: accessSubjectTypeSchema,
    id: z.uuid(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export type CreatePublicLinkDto = z.infer<typeof createPublicLinkSchema>;

export const createPublicLinkResponseSchema = z.object({
  id: z.uuid(),
  type: accessSubjectTypeSchema,
  subjectId: z.uuid(),
  expiresAt: z.iso.datetime().nullable(),
  token: z.string(),
});

export type CreatePublicLinkResponse = z.infer<
  typeof createPublicLinkResponseSchema
>;

export const resolvePublicLinkSchema = z
  .object({
    token: z.string().min(1).max(128),
  })
  .strict();

export type ResolvePublicLinkDto = z.infer<typeof resolvePublicLinkSchema>;

export const resolvePublicLinkResponseSchema = z.object({
  type: accessSubjectTypeSchema,
  subjectId: z.uuid(),
  dataRoomId: z.uuid(),
  accessExpiresAt: z.iso.datetime().nullable(),
});

export type ResolvePublicLinkResponse = z.infer<
  typeof resolvePublicLinkResponseSchema
>;
