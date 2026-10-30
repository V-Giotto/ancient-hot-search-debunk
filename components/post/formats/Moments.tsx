import type { PublicTopic } from "@/lib/public-topic";
import { Comments } from "../Comments";
import { Author, Body, Cover, Stats, Tags, Title } from "./Shared";

export function Moments({ topic }: { topic: PublicTopic }) {
  return <article data-format="moments" className="overflow-hidden rounded-2xl border border-ink/7 bg-card">
    <div className="border-b border-ink/7 bg-gold/10 px-5 py-3 text-sm font-bold">朋友圈 · 手作动态</div>
    <div className="p-5"><Author topic={topic} /><Title topic={topic} /><Body topic={topic} />
      <div aria-label="朋友圈配图格" className="mt-5 grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
        <div className="col-span-2"><Cover topic={topic} /></div>
        <div className="bg-gold/15 p-4 text-center"><span className="text-3xl font-bold text-[#7d5b32]">字</span><p className="mt-2 text-xs text-muted">材料，放大看看</p></div>
        <div className="bg-[#426b58]/10 p-4 text-center"><span className="text-3xl font-bold text-[#426b58]">印</span><p className="mt-2 text-xs text-muted">工艺，翻书找找</p></div>
      </div><Tags topic={topic} />
      <p className="mt-5 rounded-lg bg-background p-3 text-sm text-[#426b58]">♡ 点赞区 · 手作围观中</p>
      <div className="mt-4"><Stats topic={topic} /></div>
    </div><Comments comments={topic.comments} />
  </article>;
}
