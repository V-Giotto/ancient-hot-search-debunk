import type { PublicTopic } from "@/lib/public-topic";
import { Body } from "./Shared";

export function News({ topic }: { topic: PublicTopic }) {
  return <div className="border-l-2 border-gold pl-3">
    <p className="text-xs text-muted">瞭望 / 人员 / 器具 · 带着问题查证</p>
    <Body topic={topic} />
  </div>;
}
