import type { PublicTopic } from "@/lib/public-topic";
import { Author, Body, Cover, Stats, Tags, Title } from "./Shared";

export function News({ topic }: { topic: PublicTopic }) {
  return <article data-format="news" className="overflow-hidden rounded-2xl border border-ink/7 bg-card">
    <div className="flex items-center justify-between gap-3 bg-accent px-5 py-3 text-white"><span className="text-sm font-bold tracking-widest">● 东京快讯</span><span className="text-xs">街巷突发播报</span></div>
    <div className="p-5 pt-0"><Title topic={topic} /><p className="mt-3 border-l-2 border-gold pl-3 text-xs text-muted">瞭望 / 人员 / 器具 · 带着问题查证</p></div>
    <Cover topic={topic} />
    <div className="p-5"><Author topic={topic} /><Body topic={topic} /><Tags topic={topic} /><div className="mt-5 border-t border-ink/7 pt-5"><Stats topic={topic} /></div></div>
  </article>;
}
