
import { PixelIcon } from "@/components/pixel/PixelIcon";
import Link from "next/link";

export function StartFirstTopic({ topicId }: { topicId: string | undefined }) {
  if (!topicId) return null;
  return <Link href={`/post/${encodeURIComponent(topicId)}`} className="primary-button">从热榜第 1 条开始<PixelIcon name="arrowRight" size={16} className="ml-2" /></Link>;
}
