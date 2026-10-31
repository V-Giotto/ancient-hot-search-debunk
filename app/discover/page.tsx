
import type { Metadata } from "next";
import { getAvailableFeedEntries as getAllFeedEntries } from "@/lib/feed";
import { DiscoverFeed } from "@/components/discover/DiscoverFeed";
import { AppShell } from "@/components/shell/AppShell";
import { DiscoverHeader } from "@/components/discover/DiscoverHeader";

export const metadata: Metadata = { title: "发现" };

export default function DiscoverPage() {
  const allTopics = getAllFeedEntries();
  const topics = allTopics.filter((topic) => topic.module === "discover").map(({ id, rank, title, category, tags, author, coverUrl, coverAlt, simulatedLikes }) => ({ id, rank, title, category, tags, author, coverUrl, coverAlt, simulatedLikes }));

  return (
    <AppShell header={<DiscoverHeader />}>
      <div className="discover-page">
        <DiscoverFeed topics={topics} firstTrendingTopicId={allTopics.find((topic) => topic.module === "trending")?.id} />
      </div>
    </AppShell>
  );
}
