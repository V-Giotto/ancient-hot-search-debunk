"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { CollectionProgress } from "@/components/progress/CollectionProgress";
import { EmptyState } from "@/components/shell/EmptyState";
import type { PublicTopic } from "@/lib/public-topic";
import { trendingTag, trendingTagClass } from "@/lib/trending-tag";
import { StatusIcon, type StatusIconName } from "@/components/social/StatusIcon";
import { MobileBriefing } from "@/components/shell/RightRail";

const tagIcons: Record<ReturnType<typeof trendingTag>, StatusIconName> = { 爆: "burst", 热: "flame", 新: "spark" };

export type TrendingTopic = Pick<PublicTopic,
  "id" | "rank" | "category" | "title" | "simulatedHeat" | "coverUrl" | "coverAlt"
>;

export function TrendingBoard({ topics, topicIds = topics.map((topic) => topic.id) }: { topics: readonly TrendingTopic[]; topicIds?: readonly string[] }) {
  const [category, setCategory] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const categories = [null, ...new Set(topics.map((topic) => topic.category))];
  const selectedIndex = categories.indexOf(category);
  const filteredTopics = category === null ? topics : topics.filter((topic) => topic.category === category);

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % categories.length; break;
      case "ArrowLeft": next = (index - 1 + categories.length) % categories.length; break;
      case "Home": next = 0; break;
      case "End": next = categories.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setCategory(categories[next]);
    tabRefs.current[next]?.focus({ preventScroll: true });
    tabRefs.current[next]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  return (
    <div className="trending-page">
      <header className="trending-hero">
        <div aria-hidden="true" className="trending-pattern">
          <svg viewBox="0 0 160 160" fill="none">
            <circle cx="80" cy="80" r="68" />
            <circle cx="80" cy="80" r="54" strokeDasharray="2 7" />
            <path d="M80 18 142 80 80 142 18 80Z M80 42 118 80 80 118 42 80Z M66 80h28M80 66v28" />
            <path d="M5 32h20V12M135 148v-20h20" />
          </svg>
        </div>
        <p className="trending-eyebrow"><span aria-hidden="true" />跨朝代 · 热点档案</p>
        <h1>古代热搜辟谣局</h1>
        <p className="trending-slogan">让古人上热搜，让你来辟谣。</p>
      </header>

      <div role="tablist" aria-label="热榜分类" className="trending-categories">
        {categories.map((item, index) => (
          <button
            key={item ?? "all"}
            ref={(node) => { tabRefs.current[index] = node; }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={item === category}
            aria-controls={`${id}-panel`}
            tabIndex={item === category ? 0 : -1}
            onClick={() => setCategory(item)}
            onKeyDown={(event) => handleTabKey(event, index)}
          >{item ?? "全部"}</button>
        ))}
      </div>

      <div className="trending-progress">
        <CollectionProgress topicIds={topicIds} compact />
      </div>
      <MobileBriefing />

      <section role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selectedIndex}`}>
        <div className="trending-list-heading">
          <h2>{category ?? "热点快讯"}</h2>
          <p aria-live="polite" aria-atomic="true">{filteredTopics.length} 条快讯 · 按热度排序</p>
        </div>
        {topics.length === 0 ? <EmptyState /> : (
          <ol aria-label="热搜排行" className="trending-list">
            {filteredTopics.map((topic) => {
              const tag = trendingTag(topic.rank, topics.length);
              return (
                <li key={topic.id} value={topic.rank} data-category={topic.category}>
                  <Link href={`/post/${encodeURIComponent(topic.id)}`} className="trending-row">
                    <span aria-label={`第 ${topic.rank} 名`} data-testid="trending-rank" className={`trending-rank trending-rank-${topic.rank <= 3 ? topic.rank : "rest"}`}>{topic.rank}</span>
                    <div className="trending-copy">
                      <h3>{topic.title}</h3>
                      <p><span className="news-category">{topic.category}</span> · {(topic.simulatedHeat / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} 万热度</p>
                    </div>
                    <div className="trending-media">
                      <span data-testid="trending-tag" className={`trending-tag ${trendingTagClass[tag]}`}><StatusIcon name={tagIcons[tag]} size={12} /><span>{tag}</span></span>
                      <img src={topic.coverUrl} alt={topic.coverAlt} width={96} height={54} className="trending-thumbnail" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <Link href="/discover" className="trending-discover">去发现页逛逛 <span aria-hidden="true">→</span></Link>
    </div>
  );
}
