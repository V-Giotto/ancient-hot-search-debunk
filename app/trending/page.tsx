import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { getAllTopics } from "@/lib/topics";

export const metadata: Metadata = { title: "热搜榜" };

export default function TrendingPage() {
  const topics = getAllTopics();

  return (
    <>
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium tracking-widest text-accent">热搜榜</p>
        <h1 className="text-2xl leading-snug font-bold">古代互联网实时吃瓜榜（模拟）</h1>
        <p className="mt-3 text-sm leading-6 text-muted">跨朝代围观，先吃瓜再查证。榜单热度均为虚构演绎数字。</p>
      </div>
      {topics.length === 0 ? <EmptyState /> : (
        <ol aria-label="热搜排行" className="divide-y divide-ink/5 rounded-2xl border border-ink/5 bg-card px-6">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link href={`/post/${encodeURIComponent(topic.id)}`} className="flex min-w-0 items-start gap-4 rounded-lg py-6 hover:text-accent">
                <span className="w-7 shrink-0 text-xl font-bold text-accent">{topic.rank}</span>
                <div className="min-w-0">
                  <h2 className="font-semibold">{topic.title}</h2>
                  <p className="mt-2 text-xs text-muted">{topic.category} · 模拟热度 {topic.simulatedHeat.toLocaleString("zh-CN")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
