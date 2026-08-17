import { z } from "zod";

export const accessSubjectTypeSchema = z.enum(["data_room", "folder", "file"]);

export type AccessSubjectType = z.infer<typeof accessSubjectTypeSchema>;

export const grantRoleSchema = z.enum(["viewer", "editor"]);

export type GrantRoleDto = z.infer<typeof grantRoleSchema>;

export const effectiveRoleSchema = z.enum(["viewer", "editor", "owner"]);

export type EffectiveRoleDto = z.infer<typeof effectiveRoleSchema>;

export const shareTokenQuerySchema = z
  .object({
    token: z.string().min(1).max(128).optional(),
  })
  .strict();

export type ShareTokenQuery = z.infer<typeof shareTokenQuerySchema>;
