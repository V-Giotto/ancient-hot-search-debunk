import type { FriendProfile } from "@/lib/friend-schema";
import { PostActions } from "../PostActions";
import type { PublicTopic } from "@/lib/public-topic";
import { newsTimestamp } from "@/lib/news-display";
import { Body, Cover, EraChip, Title } from "./Shared";

export function News({ topic, friends }: { topic: PublicTopic; friends?: readonly FriendProfile[] }) {
  const news = topic.news!;
  return <article data-format="news" data-module="trending" className="post-article news-article">
    <div data-post-section="masthead" className="news-masthead"><span>热点报道</span><span>{topic.category} / {topic.id}</span></div>
    <div data-post-section="title"><Title topic={topic} /></div>
    <div data-post-section="byline" className="news-byline"><span>报道 · {news.outlet}</span><time dateTime={news.publishedAt}>发布于 {newsTimestamp(news.publishedAt)}</time><EraChip topic={topic} /></div>
    <div data-post-section="lead" className="news-lead"><p>{news.lead}</p></div>
    <div data-post-section="cover"><Cover topic={topic} /></div>
    <div data-post-section="body"><Body topic={topic} /></div>
    <section data-post-section="related" className="news-related" aria-labelledby="related-heading">
      <h2 id="related-heading">相关报道</h2>
      <ul>{news.related.map((text, index) => <li key={text}><p className="news-related-label">{topic.category} · 线索 {String(index + 1).padStart(2, "0")}</p><p>{text}</p></li>)}</ul>
    </section>
    <div data-post-section="actions" className="post-statistics"><PostActions topic={topic} friends={friends} /></div>
  </article>;
}
