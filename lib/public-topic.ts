import type { HotTopic } from "./schemas";

/** 显式白名单：服务端页面只能把这份题面传给客户端组件。 */
export type PublicTopic = Pick<HotTopic,
  "id" | "era" | "rank" | "module" | "format" | "category" | "tags" | "title" | "coverUrl" | "coverAlt" |
  "author" | "body" | "news" | "simulatedHeat" | "simulatedViews" | "simulatedLikes" | "simulatedComments" |
  "simulatedReposts" | "simulatedBookmarks" | "comments" | "claim" | "reviewStatus"
>;

export function toPublicTopic(topic: HotTopic): PublicTopic {
  return {
    id: topic.id, era: topic.era, rank: topic.rank, module: topic.module, category: topic.category, tags: topic.tags,
    ...(topic.format ? { format: topic.format } : {}),
    title: topic.title, coverUrl: topic.coverUrl, coverAlt: topic.coverAlt,
    author: topic.author, body: topic.body, simulatedHeat: topic.simulatedHeat,
    ...(topic.news ? { news: topic.news } : {}),
    simulatedViews: topic.simulatedViews,
    simulatedLikes: topic.simulatedLikes, simulatedComments: topic.simulatedComments,
    simulatedReposts: topic.simulatedReposts, simulatedBookmarks: topic.simulatedBookmarks,
    comments: topic.comments, claim: topic.claim, reviewStatus: topic.reviewStatus,
  };
}
