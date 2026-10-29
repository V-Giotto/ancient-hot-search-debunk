import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { getAllTopics } from "@/lib/topics";

export const metadata: Metadata = { title: "发现" };

export default function DiscoverPage() {
  const topics = getAllTopics();

  return (
    <>
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium tracking-widest text-accent">发现</p>
        <h1 className="text-2xl leading-snug font-bold">跨时空吃瓜现场</h1>
        <p className="mt-3 text-sm leading-6 text-muted">换个角度逛热搜。这里与热搜榜共享同一份内容，互动数字均为模拟。</p>
      </div>
      {topics.length === 0 ? <EmptyState /> : (
        <ul aria-label="发现话题" className="grid grid-cols-2 gap-5">
          {topics.map((topic) => (
            <li key={topic.id} className="min-w-0 rounded-2xl border border-ink/5 bg-card">
              <Link href={`/post/${encodeURIComponent(topic.id)}`} className="block rounded-2xl p-6 hover:text-accent">
                <p className="mb-3 text-xs text-muted">{topic.category}</p>
                <h2 className="leading-7 font-semibold">{topic.title}</h2>
                <p className="mt-5 text-xs text-muted">{topic.author.name} · 模拟点赞 {topic.simulatedLikes.toLocaleString("zh-CN")}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
