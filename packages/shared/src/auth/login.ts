import { z } from "zod";
import { authUserSchema } from "./user";

export const loginSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8).max(72),
  })
  .strict();

export type LoginDto = z.infer<typeof loginSchema>;

export const loginResponseSchema = authUserSchema;

export type LoginResponse = z.infer<typeof loginResponseSchema>;
