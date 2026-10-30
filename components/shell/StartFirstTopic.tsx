import Link from "next/link";

export function StartFirstTopic({ topicId }: { topicId: string | undefined }) {
  if (!topicId) return null;
  return <Link href={`/post/${encodeURIComponent(topicId)}`} className="primary-button">从热榜第 1 条开始<span aria-hidden="true" className="ml-2">→</span></Link>;
}
