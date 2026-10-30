import type { PublicTopic } from "@/lib/public-topic";
import { Body } from "./Shared";

export function Post({ topic }: { topic: PublicTopic }) {
  return <Body topic={topic} />;
}
