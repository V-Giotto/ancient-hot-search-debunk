import type { PublicTopic } from "@/lib/public-topic";
import { newsTimestamp } from "@/lib/news-display";
import { postRelativeTime } from "@/lib/social-display";
import { AuthorRow } from "@/components/social/AuthorRow";
import { WordingText } from "../Participation";

export function Author({ topic }: { topic: PublicTopic }) {
  return <AuthorRow name={topic.author.name} handle={topic.author.handle} avatarUrl={topic.author.avatarUrl} relativeTime={topic.publishedAt ? newsTimestamp(topic.publishedAt) : postRelativeTime(topic.rank)} isAuthor={topic.module === "discover"} />;
}

export function Title({ topic }: { topic: PublicTopic }) {
  return <h1 className="post-title">{topic.title}</h1>;
}

export function EraChip({ topic }: { topic: PublicTopic }) {
  return <span aria-label={`历史年代：${topic.era.label}`} className="era-chip inline-flex max-w-full items-center rounded-full bg-gold/15 px-2 py-1 text-xs font-medium text-[#7d5b32]">{topic.era.label}</span>;
}

export function Body({ topic }: { topic: PublicTopic }) {
  return <p className="post-body"><WordingText text={topic.body} /></p>;
}

export function Tags({ topic }: { topic: PublicTopic }) {
  return <div className="mt-4 flex flex-wrap gap-3 text-xs text-accent">{topic.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>;
}

export function Cover({ topic }: { topic: PublicTopic }) {
  return <figure className="post-cover"><img src={topic.coverUrl} alt={topic.coverAlt} width={1200} height={675} /></figure>;
}
