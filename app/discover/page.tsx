import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { getAllTopics } from "@/lib/topics";
import { SocialIcon } from "@/components/social/SocialIcon";
import { compactCount } from "@/lib/social-display";

export const metadata: Metadata = { title: "发现" };

export default function DiscoverPage() {
  const topics = getAllTopics();

  return (
    <>
      <div className="discover-heading">
        <div><p className="eyebrow">发现 · 街巷见闻</p><h1>跨时空吃瓜现场</h1></div>
        <Link href="/trending">去热搜榜 ↗</Link>
      </div>
      {topics.length === 0 ? <EmptyState /> : (
        <ul aria-label="发现话题" className="discover-masonry">
          {topics.map((topic) => (
            <li key={topic.id} className="discover-card">
              <Link href={`/post/${encodeURIComponent(topic.id)}`}>
                <img src={topic.coverUrl} alt={topic.coverAlt} width={1200} height={675} className="discover-cover" />
                <div className="discover-copy">
                  <h2>{topic.title.replaceAll("#", "").replace("家人们谁懂啊！", "")}</h2>
                  <div className="discover-byline">
                    <img src={topic.author.avatarUrl} alt={`${topic.author.name}头像`} width={22} height={22} />
                    <span className="discover-author" title={topic.author.name}>{topic.author.name}</span>
                    <span className="discover-likes" title={topic.simulatedLikes.toLocaleString("zh-CN")}><SocialIcon name="like" /><span className="sr-only">点赞 </span>{compactCount(topic.simulatedLikes)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
