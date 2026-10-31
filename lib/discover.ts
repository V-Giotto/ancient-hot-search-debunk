import type { PublicTopic } from "./public-topic";

export type DiscoverTopic = Pick<PublicTopic, "id" | "rank" | "title" | "category" | "tags" | "author" | "coverUrl" | "coverAlt" | "simulatedLikes">;

/** 保留现有发现页匹配规则，全部在本地执行。 */
export function filterDiscoverTopics<T extends DiscoverTopic>(topics: readonly T[], query: string): T[] {
  const keyword = query.trim().toLocaleLowerCase("zh-CN");
  return topics.filter((topic) => [topic.title, topic.category, ...topic.tags, topic.author.name]
    .some((text) => text.toLocaleLowerCase("zh-CN").includes(keyword)));
}
