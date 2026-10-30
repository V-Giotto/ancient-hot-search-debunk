"use client";

import Link from "next/link";
import type { PublicTopic } from "@/lib/public-topic";
import { Comments } from "./Comments";
import { VerdictTask } from "./VerdictTask";
import { PostFormat } from "./formats";

export function PostExperience({ topic }: { topic: PublicTopic }) {
  return (
    <div className="space-y-6">
      <nav aria-label="面包屑" className="flex flex-wrap items-center gap-2 text-sm text-muted"><Link href="/trending" className="hover:text-accent">← 返回热搜榜</Link><span>/</span><Link href="/discover" className="hover:text-accent">发现</Link><span>/ 帖子 {topic.id}</span></nav>
      <PostFormat topic={topic} />
      {topic.format !== "moments" && <Comments comments={topic.comments} />}
      <VerdictTask key={topic.id} topic={topic} />
      <Link href="/trending" className="inline-block py-2 text-sm text-accent hover:underline">← 返回热搜榜，继续围观</Link>
    </div>
  );
}
