import { z } from "zod";

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
});

export type AuthUser = z.infer<typeof authUserSchema>;
