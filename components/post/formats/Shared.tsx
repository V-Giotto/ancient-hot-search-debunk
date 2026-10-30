import type { PublicTopic } from "@/lib/public-topic";

export function Author({ topic }: { topic: PublicTopic }) {
  return <div className="flex items-center gap-3">
    <img src={topic.author.avatarUrl} alt={`${topic.author.name}原创头像`} width={48} height={48} className="size-12 shrink-0 rounded-xl" />
    <div className="min-w-0"><p className="font-bold">{topic.author.name}</p><p className="mt-1 text-xs leading-5 text-muted">{topic.author.bio}</p></div>
  </div>;
}

export function Title({ topic }: { topic: PublicTopic }) {
  return <h1 className="mt-5 text-2xl leading-relaxed font-bold">{topic.title}</h1>;
}

export function Body({ topic }: { topic: PublicTopic }) {
  return <p className="mt-4 leading-8 whitespace-pre-wrap">{topic.body}</p>;
}

export function Tags({ topic }: { topic: PublicTopic }) {
  return <div className="mt-4 flex flex-wrap gap-3 text-xs text-accent">{topic.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>;
}

export function Cover({ topic }: { topic: PublicTopic }) {
  return <figure><img src={topic.coverUrl} alt={topic.coverAlt} width={1200} height={675} className="aspect-video w-full object-cover" /></figure>;
}

export function Stats({ topic }: { topic: PublicTopic }) {
  return <dl className="grid grid-cols-2 gap-3 text-sm text-muted" aria-label="互动统计">
    {[["点赞", topic.simulatedLikes], ["转发", topic.simulatedReposts], ["收藏", topic.simulatedBookmarks], ["评论", topic.simulatedComments]].map(([label, count]) => <div key={label}><dt className="inline">{label} </dt><dd className="inline font-semibold text-ink">{Number(count).toLocaleString("zh-CN")}</dd></div>)}
  </dl>;
}
