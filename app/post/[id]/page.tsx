import { notFound } from "next/navigation";
import { PostExperience } from "@/components/post/PostExperience";
import { toPublicTopic } from "@/lib/public-topic";
import { getTopicById } from "@/lib/topics";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = getTopicById(id);
  if (!topic) notFound();

  return <PostExperience topic={toPublicTopic(topic)} />;
}
