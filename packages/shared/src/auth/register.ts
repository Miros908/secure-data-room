import { z } from "zod";
import { authUserSchema } from "./user";

export const registerSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8).max(72),
    name: z.string().min(1).max(120),
  })
  .strict();

export type RegisterDto = z.infer<typeof registerSchema>;

export const registerResponseSchema = authUserSchema;

export type RegisterResponse = z.infer<typeof registerResponseSchema>;
