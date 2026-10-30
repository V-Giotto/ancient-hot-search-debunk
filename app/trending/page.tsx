import type { Metadata } from "next";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
import { getAllTopics } from "@/lib/topics";

export const metadata: Metadata = { title: "热搜榜" };

export default function TrendingPage() {
  // 仅传递榜单题面，答案、史料和解析始终留在服务端。
  const topics = getAllTopics().map(({ id, rank, category, title, simulatedHeat, coverUrl, coverAlt }) => ({
    id, rank, category, title, simulatedHeat, coverUrl, coverAlt,
  }));

  return <TrendingBoard topics={topics} />;
}
