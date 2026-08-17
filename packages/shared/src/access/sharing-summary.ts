import { z } from "zod";
import { accessSubjectTypeSchema } from "./subject";

export const shareSourceSchema = z.object({
  type: accessSubjectTypeSchema,
  id: z.uuid(),
  name: z.string(),
  dataRoomId: z.uuid(),
});

export type ShareSource = z.infer<typeof shareSourceSchema>;

export const sharingSummarySchema = z.object({
  peopleCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  hasPublicLink: z.boolean(),
  inheritedFrom: shareSourceSchema.nullable(),
});

export type SharingSummary = z.infer<typeof sharingSummarySchema>;

export function emptySharingSummary(
  inheritedFrom: ShareSource | null = null,
): SharingSummary {
  return {
    peopleCount: 0,
    pendingCount: 0,
    hasPublicLink: false,
    inheritedFrom,
  };
}

export function hasDirectSharing(summary: SharingSummary): boolean {
  return (
    summary.peopleCount > 0 ||
    summary.pendingCount > 0 ||
    summary.hasPublicLink
  );
}

export function hasAnySharing(summary: SharingSummary): boolean {
  return hasDirectSharing(summary) || summary.inheritedFrom !== null;
}
