import type { PublicTopic } from "@/lib/public-topic";
import { Post } from "./Post";
import { News } from "./News";
import { Moments } from "./Moments";
import { Chat } from "./Chat";
import { Poll } from "./Poll";
import { Author, Cover, Stats, Tags, Title } from "./Shared";

const templates = { post: Post, news: News, moments: Moments, chat: Chat, poll: Poll };
const labels = {
  post: ["热搜帖子", "街巷热议"],
  news: ["● 东京快讯", "街巷突发播报"],
  moments: ["朋友圈", "手作动态"],
  chat: ["语录核对群", "聊天记录"],
  poll: ["读书会", "对比投票"],
};

export function PostFormat({ topic }: { topic: PublicTopic }) {
  if (topic.module === "trending") return <article data-format="news" data-module="trending" className="post-article news-article">
    <div data-post-section="masthead" className="news-masthead"><span>热点快讯</span><span>话题通报 / {topic.id}</span></div>
    <div data-post-section="format" className="post-format-bar"><span>{topic.category}</span><span>街巷突发播报</span></div>
    <div data-post-section="title"><Title topic={topic} /></div>
    <div data-post-section="body"><News topic={topic} /><Tags topic={topic} /></div>
    <div data-post-section="cover"><Cover topic={topic} /></div>
    <div data-post-section="stats" className="post-statistics"><Stats topic={topic} /></div>
  </article>;
  const format = topic.format ?? "post";
  const Template = templates[format];
  const [label, description] = labels[format];
  return <article data-format={format} data-module="discover" className="post-article">
    <div data-post-section="author" className="post-author"><Author topic={topic} /></div>
    <div data-post-section="format" className="post-format-bar"><span>{label}</span><span>{description}</span></div>
    <div data-post-section="title"><Title topic={topic} /></div>
    <div data-post-section="body"><Template key={topic.id} topic={topic} /><Tags topic={topic} /></div>
    <div data-post-section="cover"><Cover topic={topic} /></div>
    <div data-post-section="stats" className="post-statistics"><Stats topic={topic} /></div>
  </article>;
}
