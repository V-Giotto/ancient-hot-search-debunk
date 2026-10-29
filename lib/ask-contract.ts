import { z } from "zod";

export const QUESTION_MAX_LENGTH = 500;
export const HISTORY_MAX_LENGTH = 6;
export const HISTORY_CONTENT_MAX_LENGTH = 1000;
export const ANSWER_MAX_LENGTH = 2000;

export const AskHistoryEntrySchema = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(HISTORY_CONTENT_MAX_LENGTH),
});

export const AskRequestSchema = z.strictObject({
  topicId: z.string().trim().min(1).max(100),
  question: z.string().trim().min(1).max(QUESTION_MAX_LENGTH),
  history: z.array(AskHistoryEntrySchema).max(HISTORY_MAX_LENGTH).optional(),
});

export const ModelAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(ANSWER_MAX_LENGTH),
  citedSourceIds: z.array(z.string().trim().min(1).max(100)).max(32),
  grounded: z.boolean(),
});

export const AskResponseSchema = ModelAnswerSchema.extend({ preview: z.boolean().optional() });
export type AskHistoryEntry = z.infer<typeof AskHistoryEntrySchema>;
export type AskResponse = z.infer<typeof AskResponseSchema>;
