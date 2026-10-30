import type { Metadata } from "next";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
import { getAllTopics } from "@/lib/topics";
import { getAllFeedEntries } from "@/lib/feed";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = { title: "热搜榜" };

export default function TrendingPage() {
  // 仅传递榜单题面，答案、史料和解析始终留在服务端。
  const allTopics = getAllTopics();
  // 榜内名次用于爆/热/新；全题库 rank 与 12 题本机进度保持独立。
  const topics = getAllFeedEntries().filter((entry) => entry.module === "trending").map(({ id, rank, category, title, simulatedHeat, coverUrl, coverAlt, news }) => ({
    id, rank, category, title, simulatedHeat, coverUrl, coverAlt,
    outlet: news!.outlet, lead: news!.lead, publishedAt: news!.publishedAt,
  }));

  return <AppShell><TrendingBoard topics={topics} topicIds={allTopics.map(({ id }) => id)} /></AppShell>;
}
