import { z } from "zod";

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1),
  })
  .strict();

export type AcceptInviteDto = z.infer<typeof acceptInviteSchema>;

export const acceptInviteResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
});

export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;
