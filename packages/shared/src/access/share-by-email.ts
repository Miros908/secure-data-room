import { z } from "zod";
import { inviteAccessSchema } from "./invite";
import { accessSubjectTypeSchema, grantRoleSchema } from "./subject";

export const shareByEmailSchema = inviteAccessSchema;

export type ShareByEmailDto = z.infer<typeof shareByEmailSchema>;

export const shareByEmailResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("grant"),
    id: z.uuid(),
    email: z.email(),
    role: grantRoleSchema,
    type: accessSubjectTypeSchema,
    subjectId: z.uuid(),
    expiresAt: z.iso.datetime().nullable(),
  }),
  z.object({
    kind: z.literal("invite"),
    id: z.uuid(),
    email: z.email(),
    role: grantRoleSchema,
    type: accessSubjectTypeSchema,
    subjectId: z.uuid(),
    expiresAt: z.iso.datetime(),
    accessExpiresAt: z.iso.datetime().nullable(),
    token: z.string(),
  }),
]);

export type ShareByEmailResponse = z.infer<typeof shareByEmailResponseSchema>;
