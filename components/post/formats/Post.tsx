import type { PublicTopic } from "@/lib/public-topic";
import { Author, Body, Cover, Stats, Tags, Title } from "./Shared";

export function Post({ topic }: { topic: PublicTopic }) {
  return <article data-format="post" className="overflow-hidden rounded-2xl border border-ink/7 bg-card">
    <div className="p-5"><Author topic={topic} /><Title topic={topic} /><Body topic={topic} /><Tags topic={topic} /></div>
    <Cover topic={topic} /><div className="p-5"><Stats topic={topic} /></div>
  </article>;
}
