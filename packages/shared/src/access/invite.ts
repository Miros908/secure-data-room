import { z } from "zod";
import { accessSubjectTypeSchema, grantRoleSchema } from "./subject";

export const inviteAccessSchema = z
  .object({
    email: z.email(),
    role: grantRoleSchema.default("viewer"),
    type: accessSubjectTypeSchema,
    id: z.uuid(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export type InviteAccessDto = z.infer<typeof inviteAccessSchema>;

export const inviteAccessResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: grantRoleSchema,
  type: accessSubjectTypeSchema,
  subjectId: z.uuid(),
  expiresAt: z.iso.datetime(),
  accessExpiresAt: z.iso.datetime().nullable(),
  token: z.string(),
});

export type InviteAccessResponse = z.infer<typeof inviteAccessResponseSchema>;
