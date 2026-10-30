"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicTopic } from "@/lib/public-topic";
import { EmptyState } from "@/components/shell/EmptyState";
import { StartFirstTopic } from "@/components/shell/StartFirstTopic";
import { SocialIcon } from "@/components/social/SocialIcon";
import { compactCount } from "@/lib/social-display";
import { MobileBriefing } from "@/components/shell/RightRail";

export type DiscoverTopic = Pick<PublicTopic, "id" | "rank" | "title" | "category" | "tags" | "author" | "coverUrl" | "coverAlt" | "simulatedLikes">;

export function DiscoverFeed({ topics, firstTrendingTopicId = topics.find((topic) => topic.rank === 1)?.id }: { topics: readonly DiscoverTopic[]; firstTrendingTopicId?: string }) {
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLocaleLowerCase("zh-CN");
  const filtered = topics.filter((topic) => [topic.title, topic.category, ...topic.tags, topic.author.name].some((text) => text.toLocaleLowerCase("zh-CN").includes(keyword)));

  if (topics.length === 0) return <EmptyState />;

  return <>
    <form role="search" aria-label="筛选发现话题" className="discover-search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="discover-query" className="text-sm font-semibold">筛选话题</label>
      <input id="discover-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、分类或作者" aria-controls="discover-results" />
      {query && <button type="button" className="secondary-button" onClick={() => setQuery("")}>清除筛选</button>}
    </form>
    <MobileBriefing />
    <p role="status" aria-live="polite" aria-atomic="true" className="mb-3 text-xs text-muted">{filtered.length} 条话题</p>
    <div id="discover-results">
      {filtered.length === 0 ? <section aria-labelledby="discover-empty-heading" className="rounded-2xl border border-dashed border-gold/50 bg-card p-5 text-center">
        <h2 id="discover-empty-heading" className="font-bold">没有找到匹配的话题</h2>
        <p className="mt-2 mb-4 text-sm leading-6 text-muted">换个关键词，或从热榜第一条开始查证。</p>
        <StartFirstTopic topicId={firstTrendingTopicId} />
      </section> : <ul aria-label="发现话题" className="discover-masonry">
        {filtered.map((topic) => <li key={topic.id} className="discover-card">
          <Link href={`/post/${encodeURIComponent(topic.id)}`}>
            <img src={topic.coverUrl} alt={topic.coverAlt} width={1200} height={675} className="discover-cover" />
            <div className="discover-copy">
              <h2>{topic.title}</h2>
              <div className="discover-byline">
                <img src={topic.author.avatarUrl} alt={`${topic.author.name}头像`} width={22} height={22} />
                <span className="discover-author" title={topic.author.name}>{topic.author.name}</span>
                <span className="discover-likes" title={topic.simulatedLikes.toLocaleString("zh-CN")}><SocialIcon name="like" /><span className="sr-only">点赞 </span>{compactCount(topic.simulatedLikes)}</span>
              </div>
            </div>
          </Link>
        </li>)}
      </ul>}
    </div>
  </>;
}
