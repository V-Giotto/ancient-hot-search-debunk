import Link from "next/link";
import type { RelatedEntry } from "@/lib/feed";
import { PixelIcon } from "@/components/pixel/PixelIcon";

export function SameTopic({ entries }: { entries: readonly RelatedEntry[] }) {
  if (!entries.length) return null;
  return <section className="same-topic panel" aria-labelledby="same-topic-heading">
    <p className="eyebrow">换个视角，接着读</p>
    <h2 id="same-topic-heading" className="text-lg font-bold">同话题还有 {entries.length} 条</h2>
    <ul aria-label="同话题推荐">{entries.map((entry) => <li key={entry.id}>
      <Link href={`/post/${entry.id}`}>
        <img src={entry.coverUrl} alt={entry.coverAlt} width={96} height={54} />
        <span><small>{entry.module === "trending" ? "热搜" : "发现"} · {entry.id}</small><strong>{entry.title}</strong></span>
        <PixelIcon name="arrowRight" size={16} />
      </Link>
    </li>)}</ul>
  </section>;
}
