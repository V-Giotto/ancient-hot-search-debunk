import { notFound } from "next/navigation";
import { PostExperience } from "@/components/post/PostExperience";
import { toPublicTopic } from "@/lib/public-topic";
import { getAllTopics } from "@/lib/topics";
import { AppShell } from "@/components/shell/AppShell";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topics = getAllTopics();
  const topic = topics.find((topic) => topic.id === id);
  if (!topic) notFound();

  return <AppShell title={`帖子 ${topic.id}`}><PostExperience topic={toPublicTopic(topic)} topicIds={topics.map((topic) => topic.id)} /></AppShell>;
}
