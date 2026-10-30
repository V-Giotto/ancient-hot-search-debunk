import type { Metadata } from "next";
import Link from "next/link";
import { getAllTopics } from "@/lib/topics";
import { DiscoverFeed } from "@/components/discover/DiscoverFeed";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = { title: "发现" };

export default function DiscoverPage() {
  const allTopics = getAllTopics();
  const topics = allTopics.filter((topic) => topic.module === "discover").map(({ id, rank, title, category, tags, author, coverUrl, coverAlt, simulatedLikes }) => ({ id, rank, title, category, tags, author, coverUrl, coverAlt, simulatedLikes }));

  return (
    <AppShell title="发现">
      <div className="discover-heading">
        <div><p className="eyebrow">发现 · 街巷见闻</p><h1>跨时空吃瓜现场</h1></div>
        <Link href="/trending">去热搜榜 ↗</Link>
      </div>
      <DiscoverFeed topics={topics} firstTrendingTopicId={allTopics.find((topic) => topic.module === "trending")?.id} />
    </AppShell>
  );
}
