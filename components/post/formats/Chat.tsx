import type { PublicTopic } from "@/lib/public-topic";
import { Author, Body, Cover, Stats, Tags, Title } from "./Shared";

export function Chat({ topic }: { topic: PublicTopic }) {
  return <article data-format="chat" className="overflow-hidden rounded-2xl border border-ink/7 bg-card">
    <div className="border-b border-ink/7 px-5 py-3 text-center text-sm font-bold">语录核对群 · 聊天记录</div>
    <div className="p-5 pt-0"><Title topic={topic} /></div>
    <div aria-label="群聊转发" className="space-y-4 bg-[#eeeae3] p-4">
      <Author topic={topic} />
      <div className="ml-3 rounded-2xl rounded-tl-none bg-white p-4"><p className="text-xs text-muted">转发消息 · 待核对</p><Body topic={topic} /><div className="mt-4 overflow-hidden rounded-lg"><Cover topic={topic} /></div></div>
      <p className="ml-8 rounded-2xl rounded-tr-none bg-[#426b58]/10 p-4 text-sm leading-7">先等等，把提问和回答一起找回来再转。</p>
    </div><div className="p-5"><Tags topic={topic} /><div className="mt-5"><Stats topic={topic} /></div></div>
  </article>;
}
