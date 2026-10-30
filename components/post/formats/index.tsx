import type { PublicTopic } from "@/lib/public-topic";
import { Post } from "./Post";
import { News } from "./News";
import { Moments } from "./Moments";
import { Chat } from "./Chat";
import { Poll } from "./Poll";

const templates = { post: Post, news: News, moments: Moments, chat: Chat, poll: Poll };

export function PostFormat({ topic }: { topic: PublicTopic }) {
  const Template = templates[topic.format ?? "post"];
  return <Template key={topic.id} topic={topic} />;
}
