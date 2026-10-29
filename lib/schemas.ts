import { z } from "zod";

const nonEmptyText = z.string().refine((value) => value.trim().length > 0, "不能为空白");
const simulatedCount = z.number().int().nonnegative();

export const ReviewStatusSchema = z.enum(["pending", "reviewed", "rejected"]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const SourceKindSchema = z.enum(["primary", "museum", "academic", "public_culture"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceSchema = z.strictObject({
  id: nonEmptyText,
  title: nonEmptyText,
  organization: nonEmptyText,
  url: z.url(),
  supports: nonEmptyText,
  locator: z.string().optional(),
  kind: SourceKindSchema,
  status: ReviewStatusSchema,
  verifiedAt: z.string().optional(),
  verifiedBy: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const CommentSchema = z.strictObject({
  id: nonEmptyText,
  author: nonEmptyText,
  avatar: z.string().optional(),
  role: z.enum(["spectator", "troll", "history_nerd", "in_world"]),
  text: nonEmptyText,
  simulatedLikes: simulatedCount,
});
export type Comment = z.infer<typeof CommentSchema>;

export const RewriteOptionSchema = z.strictObject({
  id: nonEmptyText,
  text: nonEmptyText,
  isBest: z.boolean(),
  feedback: nonEmptyText,
});
export type RewriteOption = z.infer<typeof RewriteOptionSchema>;

export const HotTopicSchema = z.strictObject({
  id: nonEmptyText,
  rank: z.number().int().positive(),
  category: nonEmptyText,
  tags: z.array(nonEmptyText),
  title: nonEmptyText,
  coverUrl: nonEmptyText,
  coverAlt: nonEmptyText,
  author: z.strictObject({
    name: nonEmptyText,
    bio: nonEmptyText,
    avatarUrl: nonEmptyText,
    fictitious: z.literal(true),
  }),
  body: nonEmptyText,
  simulatedHeat: simulatedCount,
  simulatedLikes: simulatedCount,
  simulatedComments: simulatedCount,
  comments: z.array(CommentSchema).min(6, "每条话题至少需要 6 条评论"),
  claim: nonEmptyText,
  isTrue: z.boolean(),
  reveal: z.strictObject({
    verdictHeadline: nonEmptyText,
    shortExplanation: nonEmptyText,
    detailedExplanation: nonEmptyText,
    correctedClaim: nonEmptyText,
    funFact: nonEmptyText,
  }),
  sourceIds: z.array(nonEmptyText).min(1, "至少需要一个来源 ID"),
  rewriteOptions: z.array(RewriteOptionSchema)
    .length(3, "必须恰好有 3 个改写选项")
    .refine((options) => options.filter((option) => option.isBest).length === 1,
      "改写选项必须恰好有 1 个 isBest: true"),
  aiFacts: z.array(nonEmptyText).min(1, "AI 事实卡不能为空"),
  aiLimitations: z.array(nonEmptyText),
  reviewStatus: ReviewStatusSchema,
  reviewBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  assetLicense: z.string().optional(),
});
export type HotTopic = z.infer<typeof HotTopicSchema>;

export const TopicProgressSchema = z.strictObject({
  topicId: nonEmptyText,
  selectedAnswer: z.boolean().optional(),
  submittedAt: z.string().optional(),
  revealed: z.boolean(),
  selectedRewriteOptionId: z.string().optional(),
});
export type TopicProgress = z.infer<typeof TopicProgressSchema>;
