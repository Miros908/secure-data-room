import { z } from "zod";

export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  statusCode: z.number().int(),
  requestId: z.string(),
  issues: z.array(validationIssueSchema).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiErrorCode = {
  badRequest: "bad_request",
  validationError: "validation_error",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  notFound: "not_found",
  conflict: "conflict",
  emailTaken: "email_taken",
  uniqueViolation: "unique_violation",
  tooManyRequests: "too_many_requests",
  internalError: "internal_error",
} as const;
