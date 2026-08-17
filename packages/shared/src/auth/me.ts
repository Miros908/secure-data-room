import { authUserSchema, type AuthUser } from "./user";

export const meResponseSchema = authUserSchema;

export type MeResponse = AuthUser;
