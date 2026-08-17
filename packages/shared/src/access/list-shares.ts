import { z } from "zod";
import { shareSourceSchema } from "./sharing-summary";
import { accessSubjectTypeSchema, grantRoleSchema } from "./subject";

export const listSharesSchema = z
  .object({
    type: accessSubjectTypeSchema,
    id: z.uuid(),
  })
  .strict();

export type ListSharesDto = z.infer<typeof listSharesSchema>;

export const shareGrantSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: grantRoleSchema,
  expiresAt: z.iso.datetime().nullable(),
});

export const shareInvitationSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: grantRoleSchema,
  expiresAt: z.iso.datetime(),
  accessExpiresAt: z.iso.datetime().nullable(),
});

export const sharePublicLinkSchema = z.object({
  id: z.uuid(),
  expiresAt: z.iso.datetime().nullable(),
});

export const inheritedShareLayerSchema = z.object({
  source: shareSourceSchema,
  grants: z.array(shareGrantSchema),
  invitations: z.array(shareInvitationSchema),
  publicLink: sharePublicLinkSchema.nullable(),
});

export type InheritedShareLayer = z.infer<typeof inheritedShareLayerSchema>;

export const listSharesResponseSchema = z.object({
  grants: z.array(shareGrantSchema),
  invitations: z.array(shareInvitationSchema),
  publicLink: sharePublicLinkSchema.nullable(),
  inherited: z.array(inheritedShareLayerSchema),
});

export type ListSharesResponse = z.infer<typeof listSharesResponseSchema>;
