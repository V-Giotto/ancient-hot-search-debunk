import type { FriendProfile } from "@/lib/friend-schema";
import type { PublicTopic } from "@/lib/public-topic";
import { Post } from "./Post";
import { News } from "./News";
import { Moments } from "./Moments";
import { Chat } from "./Chat";
import { Poll } from "./Poll";
import { Author, Cover, Tags, Title } from "./Shared";
import { FollowButton } from "../FollowButton";
import { PostActions } from "../PostActions";

const templates = { post: Post, news: Post, moments: Moments, chat: Chat, poll: Poll };
const labels = {
  post: ["我的见闻", "来聊聊你的看法"],
  news: ["我的见闻", "来聊聊你的看法"],
  moments: ["朋友圈", "手作动态"],
  chat: ["语录核对群", "聊天记录"],
  poll: ["读书会", "对比投票"],
};

export function PostFormat({ topic, friends = [] }: { topic: PublicTopic; friends?: readonly FriendProfile[] }) {
  if (topic.module === "trending") return <News topic={topic} friends={friends} />;
  const format = topic.format ?? "post";
  const Template = templates[format];
  const [label, description] = labels[format];
  return <article data-format={format} data-module="discover" className="post-article social-article">
    <div data-post-section="author" className="post-author"><Author topic={topic} /><FollowButton handle={topic.author.handle} name={topic.author.name} /></div>
    <div data-post-section="format" className="post-format-bar"><span>{label}</span><span>{description}</span></div>
    <div data-post-section="title"><Title topic={topic} /></div>
    <div data-post-section="cover"><Cover topic={topic} /></div>
    <div data-post-section="body"><Template key={topic.id} topic={topic} /><p className="post-invitation"><span aria-hidden="true">💬</span> 我先留个问号，你怎么看？</p><Tags topic={topic} /></div>
    <div data-post-section="actions" className="post-statistics"><PostActions topic={topic} friends={friends} /></div>
  </article>;
}
