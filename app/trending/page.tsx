import { trendingTag, trendingTagClass } from "@/lib/trending-tag";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { CollectionProgress } from "@/components/progress/CollectionProgress";
import { getAllTopics } from "@/lib/topics";

export const metadata: Metadata = { title: "热搜榜" };

export default function TrendingPage() {
  const topics = getAllTopics();

  return (
    <>
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium tracking-widest text-accent">热搜榜</p>
        <h1 className="text-2xl leading-snug font-bold">古代互联网实时吃瓜榜</h1>
        <p className="mt-3 text-sm leading-6 text-muted">跨朝代围观，先吃瓜再查证。</p>
        <p className="mt-2 text-xs text-muted">本期 H03 · 先来围观这一锅</p>
      </div>
      <CollectionProgress topicIds={topics.map((topic) => topic.id)} />
      {topics.length === 0 ? <EmptyState /> : (
        <ol aria-label="热搜排行" className="divide-y divide-ink/5 rounded-2xl border border-ink/5 bg-card px-3">
          {topics.map((topic) => (
            <li key={topic.id}>
              <Link href={`/post/${encodeURIComponent(topic.id)}`} className="flex min-w-0 items-start gap-2 rounded-lg py-5 hover:text-accent">
                <span className="w-5 shrink-0 text-lg font-bold text-accent">{topic.rank}</span>
                <div className="min-w-0 flex-1">
                  <span data-testid="trending-tag" className={`mb-2 inline-block rounded-md px-2 py-1 text-[11px] font-bold ${trendingTagClass[trendingTag(topic.rank, topics.length)]}`}>{trendingTag(topic.rank, topics.length)}</span>
                  <h2 className="text-sm leading-6 font-semibold">{topic.title}</h2>
                  <p className="mt-3 text-xs text-muted">{topic.category} · 热度 {topic.simulatedHeat.toLocaleString("zh-CN")}</p>
                </div>
                <img src={topic.coverUrl} alt={topic.coverAlt} width={112} height={63} className="aspect-video h-auto w-28 shrink-0 rounded-xl object-contain" />
              </Link>
            </li>
          ))}
        </ol>
      )}
      <Link href="/discover" className="mt-6 inline-block text-sm text-accent hover:underline">去发现页逛逛 →</Link>
    </>
  );
}
