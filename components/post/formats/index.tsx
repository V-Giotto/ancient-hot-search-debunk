
import { PixelIcon } from "@/components/pixel/PixelIcon";
import type { FriendProfile } from "@/lib/friend-schema";
import type { PublicTopic } from "@/lib/public-topic";
import { discussionPrompt } from "@/lib/discussion-prompt";
import { Post } from "./Post";
import { News } from "./News";
import { Moments } from "./Moments";
import { Chat } from "./Chat";
import { Poll } from "./Poll";
import { Author, Cover, EraChip, Tags, Title } from "./Shared";
import { FollowButton } from "../FollowButton";
import { PostActions } from "../PostActions";

const templates = { post: Post, news: Post, moments: Moments, chat: Chat, poll: Poll };
const labels = {
  post: ["我的见闻", "图文"],
  news: ["我的见闻", "图文"],
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
    <div data-post-section="format" className="post-format-bar"><span className="flex flex-wrap items-center gap-2"><span>{label}</span><EraChip topic={topic} /></span><span>{description}</span><a href="#task-heading" className="direct-verdict">直接判断</a></div>
    <div data-post-section="title"><Title topic={topic} /></div>
    <div data-post-section="cover"><Cover topic={topic} /></div>
    <div data-post-section="body"><Template key={topic.id} topic={topic} /><p className="post-invitation"><PixelIcon name="reply" size={16} /> {discussionPrompt(topic.id)} <a href="#comments-heading">查看讨论</a></p><Tags topic={topic} /></div>
    <div data-post-section="actions" className="post-statistics"><PostActions topic={topic} friends={friends} /></div>
  </article>;
}
