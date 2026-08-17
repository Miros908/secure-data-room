import { z } from "zod";

export const revokeAccessSchema = z
  .object({
    kind: z.enum(["grant", "invite", "public_link"]),
    id: z.uuid(),
  })
  .strict();

export type RevokeAccessDto = z.infer<typeof revokeAccessSchema>;

export const revokeAccessResponseSchema = z.object({
  ok: z.literal(true),
});

export type RevokeAccessResponse = z.infer<typeof revokeAccessResponseSchema>;
