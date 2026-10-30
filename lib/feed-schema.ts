import { z } from "zod";
import { HotTopicSchema } from "./schemas";

export const FeedIdSchema = z.string().regex(/^(?:H\d{2,3}|T(?:0[1-9]|1[0-2])|P(?:0[1-9]|1[0-8]))$/);
const display = HotTopicSchema.shape;

/** 展示内容不存答案、来源或 AI 事实；审核状态与历史题审核分开。 */
export const FeedEntrySchema = z.strictObject({
  id: FeedIdSchema,
  topicId: z.string().regex(/^H\d{2,3}$/),
  module: display.module,
  rank: display.rank,
  format: z.enum(["post", "news", "moments", "chat", "poll"]),
  category: display.category,
  tags: display.tags.min(1),
  title: display.title.refine((title) => !/^#|#$/.test(title), "标题不带首尾 #"),
  coverUrl: display.coverUrl,
  coverAlt: display.coverAlt,
  author: display.author,
  publishedAt: z.iso.datetime({ offset: true }),
  body: display.body,
  news: display.news,
  simulatedHeat: display.simulatedHeat,
  simulatedViews: display.simulatedViews,
  simulatedLikes: display.simulatedLikes,
  simulatedComments: display.simulatedComments,
  simulatedReposts: display.simulatedReposts,
  simulatedBookmarks: display.simulatedBookmarks,
  comments: display.comments.max(10),
  fictionalFraming: z.literal(true),
  statisticsOrigin: z.literal("design"),
  editorialReviewStatus: z.literal("pending"),
}).superRefine((entry, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (entry.module === "trending" && (!entry.news || entry.format !== "news")) issue("news", "热搜须有新闻模板与报道元数据");
  if (/^[TP]/.test(entry.id) && entry.coverUrl !== `/covers/feed/${entry.id.toLowerCase()}.webp`) issue("coverUrl", "新增条目须使用独立 WebP 封面");
  if (entry.news && entry.news.publishedAt !== entry.publishedAt) issue("publishedAt", "发布时间须一致");
  const ids = new Set<string>();
  for (const comment of entry.comments) {
    if (ids.has(comment.id)) issue("comments", "评论 ID 重复");
    ids.add(comment.id);
    const thread = new Set([comment.id]);
    for (const reply of comment.replies ?? []) {
      if (ids.has(reply.id) || !thread.has(reply.replyTo)) issue("comments", "回复须唯一并指向本线程已存在的节点");
      ids.add(reply.id); thread.add(reply.id);
    }
  }
});
export type FeedEntry = z.infer<typeof FeedEntrySchema>;
