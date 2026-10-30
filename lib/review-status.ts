import type { HotTopic, Source } from "./schemas";

export const REVIEW_STATUS_LABELS = {
  pending: "待人工审核",
  reviewed: "已人工审核",
  rejected: "审核未通过",
};

export function getContentReviewStatus(topicStatus: HotTopic["reviewStatus"], sources: Source[]) {
  const statuses = [topicStatus, ...sources.map((source) => source.status)];
  if (statuses.includes("rejected")) return "rejected";
  return statuses.includes("pending") ? "pending" : "reviewed";
}
