import { notFound } from "next/navigation";
import { PostExperience } from "@/components/post/PostExperience";
import { toPublicTopic } from "@/lib/public-topic";
import { getAllTopics } from "@/lib/topics";
import { AppShell } from "@/components/shell/AppShell";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const topic = getAllTopics().find((topic) => topic.id === id);
  return { title: topic?.title ?? "页面未找到" };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topics = getAllTopics();
  const topic = topics.find((topic) => topic.id === id);
  if (!topic) notFound();

  return <AppShell title={`${topic.module === "trending" ? "热搜 · 快讯" : "发现 · 帖子"} ${topic.id}`}><PostExperience topic={toPublicTopic(topic)} topicIds={topics.map((topic) => topic.id)} /></AppShell>;
}
