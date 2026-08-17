import { z } from "zod";
import { accessSubjectTypeSchema } from "../access/subject";

export const liveTargetSchema = z.object({
  kind: accessSubjectTypeSchema,
  id: z.uuid(),
});

export type LiveTarget = z.infer<typeof liveTargetSchema>;

export const accessGrantedEventSchema = z.object({
  type: z.literal("access_granted"),
  dataRoomId: z.uuid(),
  target: liveTargetSchema,
});

export const accessInvalidatedEventSchema = z.object({
  type: z.literal("access_invalidated"),
  reason: z.enum(["revoked", "expired"]),
  dataRoomId: z.uuid(),
  target: liveTargetSchema,
});

export const resourceGoneEventSchema = z.object({
  type: z.literal("resource_gone"),
  reason: z.literal("deleted"),
  dataRoomId: z.uuid(),
  subject: z.object({
    kind: z.enum(["folder", "file"]),
    id: z.uuid(),
  }),
});

export const activityRecordedEventSchema = z.object({
  type: z.literal("activity_recorded"),
  dataRoomId: z.uuid(),
});

export const liveEventSchema = z.discriminatedUnion("type", [
  accessGrantedEventSchema,
  accessInvalidatedEventSchema,
  resourceGoneEventSchema,
  activityRecordedEventSchema,
]);

export type LiveEvent = z.infer<typeof liveEventSchema>;
export type AccessGrantedEvent = z.infer<typeof accessGrantedEventSchema>;
export type AccessInvalidatedEvent = z.infer<
  typeof accessInvalidatedEventSchema
>;
export type ResourceGoneEvent = z.infer<typeof resourceGoneEventSchema>;
export type ActivityRecordedEvent = z.infer<typeof activityRecordedEventSchema>;

export const streamEventsQuerySchema = z
  .object({
    token: z.string().min(1).max(128).optional(),
    dataRoomId: z.uuid().optional(),
  })
  .strict();

export type StreamEventsQuery = z.infer<typeof streamEventsQuerySchema>;
