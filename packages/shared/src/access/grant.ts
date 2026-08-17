import { z } from "zod";
import { accessSubjectTypeSchema, grantRoleSchema } from "./subject";

export const grantAccessSchema = z
  .object({
    userId: z.uuid(),
    role: grantRoleSchema.default("viewer"),
    type: accessSubjectTypeSchema,
    id: z.uuid(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export type GrantAccessDto = z.infer<typeof grantAccessSchema>;

export const grantAccessResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  role: grantRoleSchema,
  type: accessSubjectTypeSchema,
  subjectId: z.uuid(),
  expiresAt: z.iso.datetime().nullable(),
});

export type GrantAccessResponse = z.infer<typeof grantAccessResponseSchema>;
