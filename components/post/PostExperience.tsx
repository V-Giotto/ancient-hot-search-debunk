"use client";

import Link from "next/link";
import type { PublicTopic } from "@/lib/public-topic";
import { Comments } from "./Comments";
import { VerdictTask } from "./VerdictTask";
import { PostFormat } from "./formats";

export function PostExperience({ topic, topicIds }: { topic: PublicTopic; topicIds: readonly string[] }) {
  return (
    <div className="space-y-6">
      <nav aria-label="面包屑" className="post-breadcrumb text-sm text-muted">
        <ol>
          <li><Link href="/trending" className="hover:text-accent">← 返回热搜榜</Link></li>
          <li>
            <span aria-hidden="true" className="breadcrumb-separator">/</span>
            <Link href="/discover" className="hover:text-accent">发现</Link>
          </li>
          <li>
            <span aria-hidden="true" className="breadcrumb-separator">/</span>
            <span aria-current="page">帖子 {topic.id}</span>
          </li>
        </ol>
      </nav>
      <PostFormat topic={topic} />
      {topic.format !== "moments" && <Comments comments={topic.comments} />}
      <VerdictTask key={topic.id} topic={topic} topicIds={topicIds} />
      <Link href="/trending" className="inline-block py-2 text-sm text-accent hover:underline">← 返回热搜榜，继续围观</Link>
    </div>
  );
}
