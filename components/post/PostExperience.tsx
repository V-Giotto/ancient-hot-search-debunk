"use client";

import Link from "next/link";
import type { PublicTopic } from "@/lib/public-topic";
import { Comments } from "./Comments";
import { VerdictTask } from "./VerdictTask";
import { PostFormat } from "./formats";

export function PostExperience({ topic, topicIds }: { topic: PublicTopic; topicIds: readonly string[] }) {
  return (
    <div className="space-y-6">
      <PostFormat topic={topic} />
      <Comments comments={topic.comments} />
      <VerdictTask key={topic.id} topic={topic} topicIds={topicIds} />
      <Link href="/trending" className="inline-block py-2 text-sm text-accent hover:underline">← 返回热搜榜，继续围观</Link>
    </div>
  );
}
