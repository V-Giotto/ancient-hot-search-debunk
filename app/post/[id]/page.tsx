import { getAllFriends, toFriendProfile } from "@/lib/friends";
import { notFound } from "next/navigation";
import { PostExperience } from "@/components/post/PostExperience";
import { getFeedEntryById, getSameTopicEntries, toPublicFeedEntry } from "@/lib/feed";
import { getAllTopics } from "@/lib/topics";
import { AppShell } from "@/components/shell/AppShell";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const topic = getFeedEntryById(id);
  return { title: topic?.title ?? "页面未找到" };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topics = getAllTopics();
  const topic = getFeedEntryById(id);
  if (!topic) notFound();

  return <AppShell title={`${topic.module === "trending" ? "热搜 · 报道" : "发现 · 帖子"} ${topic.id}`} backHref={`/${topic.module}`} backLabel={topic.module === "trending" ? "返回热搜榜" : "返回发现"}><PostExperience friends={getAllFriends().map(toFriendProfile)} topic={toPublicFeedEntry(topic)} topicIds={topics.map((topic) => topic.id)} relatedEntries={getSameTopicEntries(topic)} /></AppShell>;
}
