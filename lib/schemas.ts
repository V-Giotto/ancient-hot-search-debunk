import { z } from "zod";
import { EraSchema } from "./era";

const nonEmptyText = z.string().refine((value) => value.trim().length > 0, "不能为空白");
const simulatedCount = z.number().int().nonnegative();

export const ReviewStatusSchema = z.enum(["pending", "reviewed", "rejected"]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// 保留 H07/H12 已审核的 by/at；新审核按 Giotto 指定的 reviewer/reviewedAt 存储。
export const EraReviewSchema = z.union([z.strictObject({
  status: z.enum(["reviewed", "pending"]),
  by: nonEmptyText.optional(),
  at: z.iso.datetime({ offset: true }).optional(),
}), z.strictObject({
  status: z.literal("reviewed"),
  reviewer: nonEmptyText,
  reviewedAt: z.iso.datetime({ offset: true }),
})]);

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

export const CommentReplySchema = z.strictObject({
  id: nonEmptyText,
  replyTo: nonEmptyText,
  author: nonEmptyText,
  avatar: z.string().optional(),
  text: nonEmptyText,
});
export type CommentReply = z.infer<typeof CommentReplySchema>;

export const CommentSchema = z.strictObject({
  id: nonEmptyText,
  author: nonEmptyText,
  avatar: z.string().optional(),
  role: z.enum(["spectator", "troll", "history_nerd", "in_world"]),
  text: nonEmptyText,
  simulatedLikes: simulatedCount,
  simulatedReplies: simulatedCount.optional(),
  simulatedReposts: simulatedCount.optional(),
  simulatedViews: simulatedCount.optional(),
  replies: z.array(CommentReplySchema).optional(),
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
  // 核心历史主题与传言、证据时间分别记录；年代审核独立于题目内容审核。
  era: EraSchema,
  rumorEra: nonEmptyText,
  coreContext: nonEmptyText,
  evidenceEra: nonEmptyText,
  eraReview: EraReviewSchema,
  rank: z.number().int().positive(),
  module: z.enum(["trending", "discover"]),
  format: z.enum(["post", "news", "moments", "chat", "poll"]).optional(),
  category: nonEmptyText,
  tags: z.array(nonEmptyText),
  title: nonEmptyText,
  coverUrl: nonEmptyText,
  coverAlt: nonEmptyText,
  author: z.strictObject({
    name: nonEmptyText,
    handle: z.string().regex(/^@[a-z_]{3,20}$/, "handle 须为 @ 加 3–20 位小写字母或下划线"),
    bio: nonEmptyText,
    avatarUrl: nonEmptyText,
    fictitious: z.literal(true),
  }),
  body: nonEmptyText,
  // 仅报道语气与展示元数据；不得作为新的历史事实或判题依据。
  news: z.strictObject({
    outlet: nonEmptyText,
    lead: nonEmptyText,
    publishedAt: z.iso.datetime({ offset: true }),
    related: z.array(nonEmptyText).length(2),
  }).optional(),
  simulatedHeat: simulatedCount,
  simulatedViews: simulatedCount,
  simulatedLikes: simulatedCount,
  simulatedComments: simulatedCount,
  simulatedReposts: simulatedCount,
  simulatedBookmarks: simulatedCount,
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
}).refine((topic) => topic.module !== "trending" || !!topic.news, {
  path: ["news"], message: "热搜需要报道元数据",
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
