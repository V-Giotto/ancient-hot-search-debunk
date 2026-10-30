import type { Metadata } from "next";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
import { getAllTopics } from "@/lib/topics";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = { title: "热搜榜" };

export default function TrendingPage() {
  // 仅传递榜单题面，答案、史料和解析始终留在服务端。
  const allTopics = getAllTopics();
  // 榜内名次用于爆/热/新；全题库 rank 与 12 题本机进度保持独立。
  const topics = allTopics.filter((topic) => topic.module === "trending").map(({ id, category, title, simulatedHeat, coverUrl, coverAlt }, index) => ({
    id, rank: index + 1, category, title, simulatedHeat, coverUrl, coverAlt,
  }));

  return <AppShell><TrendingBoard topics={topics} topicIds={allTopics.map(({ id }) => id)} /></AppShell>;
}
