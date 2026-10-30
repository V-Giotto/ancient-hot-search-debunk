import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { getAllTopics } from "@/lib/topics";

export const metadata: Metadata = { title: "发现" };

export default function DiscoverPage() {
  const topics = getAllTopics();

  return (
    <>
      <Link href="/trending" className="mb-5 inline-block text-sm text-accent hover:underline">← 返回热搜榜</Link>
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium tracking-widest text-accent">发现</p>
        <h1 className="text-2xl leading-snug font-bold">跨时空吃瓜现场</h1>
        <p className="mt-3 text-sm leading-6 text-muted">换个角度逛热搜。这里与热搜榜共享同一份内容，互动数字均为模拟。</p>
      </div>
      {topics.length === 0 ? <EmptyState /> : (
        <ul aria-label="发现话题" className="grid grid-cols-2 items-start gap-3">
          {topics.map((topic) => (
            <li key={topic.id} className="min-w-0 rounded-2xl border border-ink/5 bg-card">
              <Link href={`/post/${encodeURIComponent(topic.id)}`} className="block overflow-hidden rounded-2xl hover:text-accent">
                <img src={topic.coverUrl} alt={topic.coverAlt} width={1200} height={675} className="aspect-video w-full object-contain" />
                <div className="p-3">
                  <p className="mb-2 text-xs text-muted">{topic.category} · 艺术创作·非史料</p>
                  <h2 className="text-sm leading-6 font-semibold">{topic.title.replaceAll("#", "").replace("家人们谁懂啊！", "")}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-accent">{topic.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                  <div className="mt-4 flex items-center gap-2"><img src={topic.author.avatarUrl} alt="原创架空头像" width={26} height={26} className="size-7 shrink-0 rounded-full" /><span className="min-w-0 text-xs text-muted">{topic.author.name}</span></div>
                  <p className="mt-3 text-xs text-muted">模拟点赞 {topic.simulatedLikes.toLocaleString("zh-CN")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
