import Link from "next/link";
import { notFound } from "next/navigation";
import { getTopicById } from "@/lib/topics";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = getTopicById(id);
  if (!topic) notFound();

  return (
    <article className="rounded-2xl border border-ink/5 bg-card p-8">
      <Link href="/trending" className="text-sm text-accent hover:underline">← 返回热搜榜</Link>
      <h1 className="mt-6 text-2xl leading-relaxed font-bold">{topic.title}</h1>
      <p className="mt-3 text-sm text-muted">{topic.author.name} · 架空账号</p>
      <p className="mt-6 leading-8 whitespace-pre-wrap">{topic.body}</p>
      <p className="mt-8 border-t border-ink/5 pt-5 text-sm text-muted">帖子详情与查证互动正在准备中。</p>
    </article>
  );
}
