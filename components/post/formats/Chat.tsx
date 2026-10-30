import type { PublicTopic } from "@/lib/public-topic";
import { Body } from "./Shared";

export function Chat({ topic }: { topic: PublicTopic }) {
  return <div aria-label="群聊转发" className="space-y-4 rounded-xl bg-[#eeeae3] p-4">
      <div className="rounded-2xl rounded-tl-none bg-white p-4"><p className="text-xs text-muted">转发消息 · 待核对</p><Body topic={topic} /></div>
      <p className="ml-8 rounded-2xl rounded-tr-none bg-[#426b58]/10 p-4 text-sm leading-7">{topic.topicId === "H11" ? "先等等，把提问和回答一起找回来再转。" : "先等等，讨论可以继续，判断前先把材料找齐。"}</p>
  </div>;
}
