import { z } from "zod";

export const stepConditionSchema = z.object({
  type: z.enum(["no_reply", "no_open", "always"]),
  afterDays: z.number().int().nonnegative(),
});
export type StepCondition = z.infer<typeof stepConditionSchema>;

export const sequenceStepSchema = z.object({
  order: z.number().int().nonnegative(),
  subject: z.string().max(200).default(""),
  body: z.string().max(20_000).default(""),
  delayDays: z.number().int().nonnegative().default(0),
  condition: stepConditionSchema.default({ type: "always", afterDays: 0 }),
});
export type SequenceStep = z.infer<typeof sequenceStepSchema>;

export const sequenceSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1).max(120),
  steps: z.array(sequenceStepSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Sequence = z.infer<typeof sequenceSchema>;

export const createSequenceSchema = z.object({
  name: z.string().min(1).max(120),
  steps: z.array(sequenceStepSchema).default([]),
});
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;

export const updateSequenceSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  steps: z.array(sequenceStepSchema).optional(),
});
export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>;
