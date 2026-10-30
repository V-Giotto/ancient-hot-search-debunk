"use client";
import Link from "next/link";
import { useSocialState } from "@/components/social/useSocialState";
import { favoriteTopics } from "@/lib/social-storage";
import type { SharedTopic } from "@/lib/chat-storage";
import { SocialIcon } from "@/components/social/SocialIcon";
export function MyFavorites({ topics }: { topics: readonly SharedTopic[] }) {
  const { state } = useSocialState();
  const favorites = favoriteTopics(topics, state);
  return <section className="my-favorites" aria-labelledby="favorites-heading">
    <h2 id="favorites-heading">我的收藏 <span>{favorites.length}</span></h2>
    {favorites.length ? <ul aria-label="我的收藏">{favorites.map((topic) => <li key={topic.id}><Link href={`/post/${topic.id}`}><span className="module-label">{topic.module === "trending" ? "热搜" : "发现"}</span><strong>{topic.title}</strong><SocialIcon name="bookmark" /></Link></li>)}</ul>
      : <div className="favorites-empty"><SocialIcon name="bookmark" /><p>还没有收藏，遇到想再读的内容就留个记号吧。</p><Link className="primary-button" href="/trending">去热搜榜看看</Link></div>}
  </section>;
}
