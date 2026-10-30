"use client";

import Link from "next/link";
import type { PublicTopic } from "@/lib/public-topic";
import { Comments } from "./Comments";
import { VerdictTask } from "./VerdictTask";
import { PostFormat } from "./formats";
import { MobileBriefing } from "@/components/shell/RightRail";

export function PostExperience({ topic, topicIds }: { topic: PublicTopic; topicIds: readonly string[] }) {
  return (
    <div className="space-y-6">
      <PostFormat topic={topic} />
      <Comments comments={topic.comments} author={topic.author.name} module={topic.module} title={topic.title} />
      <MobileBriefing />
      <VerdictTask key={topic.id} topic={topic} topicIds={topicIds} />
      <Link href={topic.module === "trending" ? "/trending" : "/discover"} className="inline-block py-2 text-sm text-accent hover:underline">← 返回{topic.module === "trending" ? "热搜榜" : "发现"}，继续围观</Link>
    </div>
  );
}
