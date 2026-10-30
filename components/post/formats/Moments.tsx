
import { PixelIcon } from "@/components/pixel/PixelIcon";
import type { PublicTopic } from "@/lib/public-topic";
import { Body } from "./Shared";

export function Moments({ topic }: { topic: PublicTopic }) {
  return <>
      <Body topic={topic} />
      <div aria-label="朋友圈配图格" className="mt-5 grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
        <div className="bg-gold/15 p-4 text-center"><span className="text-3xl font-bold text-[#7d5b32]">字</span><p className="mt-2 text-xs text-muted">材料，放大看看</p></div>
        <div className="bg-[#426b58]/10 p-4 text-center"><span className="text-3xl font-bold text-[#426b58]">印</span><p className="mt-2 text-xs text-muted">工艺，翻书找找</p></div>
      </div>
      <p className="mt-5 rounded-lg bg-background p-3 text-sm text-[#426b58]"><PixelIcon name="like" size={16} /> 点赞区 · 手作围观中</p>
  </>;
}
