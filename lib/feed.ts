// 服务端读取；客户端只接收公开题面或推荐摘要。
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { FeedEntrySchema, type FeedEntry } from "./feed-schema";
import { getAllTopics, getAvailableTopics } from "./topics";
import { toPublicTopic, type PublicTopic } from "./public-topic";

export function validateFeedSet(input: unknown, topicIds: readonly string[]): FeedEntry[] {
  const entries = z.array(FeedEntrySchema).parse(input);
  const ids = new Set<string>();
  const commentIds = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`信息流 ID 重复：${entry.id}`);
    if (!topicIds.includes(entry.topicId)) throw new Error(`${entry.id} 的 topicId 不存在：${entry.topicId}`);
    if (entry.id.startsWith("H") && entry.id !== entry.topicId) throw new Error(`旧链接映射不一致：${entry.id}`);
    ids.add(entry.id);
    for (const comment of entry.comments) {
      for (const node of [comment, ...(comment.replies ?? [])]) {
        if (commentIds.has(node.id)) throw new Error(`跨帖评论 ID 重复：${node.id}`);
        commentIds.add(node.id);
      }
    }
  }
  for (const module of ["trending", "discover"] as const) {
    const ordered = entries.filter((entry) => entry.module === module).sort((a, b) => a.rank - b.rank);
    if (ordered.some((entry, index) => entry.rank !== index + 1)) throw new Error(`${module} 排名须连续且唯一`);
    if (module === "trending" && ordered.some((entry, index) => index > 0 && entry.simulatedHeat > ordered[index - 1].simulatedHeat)) throw new Error("热搜须按设计热度降序排列");
  }
  return entries;
}

export function getAllFeedEntries(): FeedEntry[] {
  const entries = ["trending", "discover"].flatMap((surface) => {
    const file = path.join(process.cwd(), "data", "feed", `${surface}.json`);
    const parsed = z.array(FeedEntrySchema).parse(JSON.parse(readFileSync(file, "utf8")));
    if (parsed.some((entry) => entry.module !== surface)) throw new Error(`${surface} 信息流模块不匹配`);
    return parsed.sort((a, b) => a.rank - b.rank);
  });
  return validateFeedSet(entries, getAllTopics().map(({ id }) => id));
}

export function getFeedEntryById(id: string): FeedEntry | undefined {
  return getAllFeedEntries().find((entry) => entry.id === id);
}

export function getAvailableFeedEntries(): FeedEntry[] {
  const ids = new Set(getAvailableTopics().map(({ id }) => id));
  return getAllFeedEntries().filter((entry) => ids.has(entry.topicId));
}

export function getAvailableFeedEntryById(id: string): FeedEntry | undefined {
  return getAvailableFeedEntries().find((entry) => entry.id === id);
}

export function toPublicFeedEntry(entry: FeedEntry): PublicTopic {
  const topic = getAllTopics().find((topic) => topic.id === entry.topicId);
  if (!topic) throw new Error(`${entry.id} 的 topicId 不存在`);
  // 白名单投影保留答案隔离；展示模板由条目决定，题面、年代、审核由题库决定。
  return { ...toPublicTopic({ ...topic, ...entry, news: entry.news }), topicId: topic.id, publishedAt: entry.publishedAt };
}

export type RelatedEntry = Pick<FeedEntry, "id" | "topicId" | "module" | "title" | "coverUrl" | "coverAlt">;
export function getSameTopicEntries(entry: Pick<FeedEntry, "id" | "topicId">): RelatedEntry[] {
  return getAvailableFeedEntries().filter((other) => other.topicId === entry.topicId && other.id !== entry.id)
    .map(({ id, topicId, module, title, coverUrl, coverAlt }) => ({ id, topicId, module, title, coverUrl, coverAlt }));
}
