"use client";

import Link from "next/link";
import type { PublicTopic } from "@/lib/public-topic";
import { Comments } from "./Comments";
import { VerdictTask } from "./VerdictTask";

export function PostExperience({ topic }: { topic: PublicTopic }) {
  return (
    <div className="space-y-6">
      <nav aria-label="面包屑" className="flex gap-3 text-sm text-muted"><Link href="/trending" className="hover:text-accent">← 返回热搜榜</Link><span>/</span><Link href="/discover" className="hover:text-accent">发现</Link><span>/ 帖子 {topic.id}</span></nav>
      <article className="overflow-hidden rounded-2xl border border-ink/7 bg-card">
        <div className="p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <img src={topic.author.avatarUrl} alt={`${topic.author.name}原创头像`} width={48} height={48} className="size-12 rounded-xl" />
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{topic.author.name}</p><span className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs">架空账号</span></div><p className="mt-1 text-xs leading-5 text-muted">{topic.author.bio}</p></div>
          </div>
          <h1 className="mt-6 text-2xl leading-relaxed font-bold">{topic.title}</h1>
          <p className="mt-4 leading-8 whitespace-pre-wrap">{topic.body}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-accent">{topic.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </div>
        <figure><img src={topic.coverUrl} alt={topic.coverAlt} width={1200} height={675} className="aspect-video w-full object-cover" /><figcaption className="bg-background/60 px-6 py-2 text-xs text-muted">原创插画 · 艺术创作·非史料</figcaption></figure>
        <div className="px-6 py-5 lg:px-8">
          <dl className="grid grid-cols-2 gap-3 text-sm text-muted sm:grid-cols-4" aria-label="模拟互动统计">
            {[["点赞", topic.simulatedLikes], ["转发", topic.simulatedReposts], ["收藏", topic.simulatedBookmarks], ["评论", topic.simulatedComments]].map(([label, count]) => <div key={label}><dt className="inline">{label} </dt><dd className="inline font-semibold text-ink">{Number(count).toLocaleString("zh-CN")}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-muted">以上数字均为模拟值，角色发言与评论均为架空演绎。</p>
        </div>
      </article>
      <Comments comments={topic.comments} />
      <VerdictTask key={topic.id} topic={topic} />
      <Link href="/trending" className="inline-block py-2 text-sm text-accent hover:underline">← 返回热搜榜，继续围观</Link>
    </div>
  );
}
