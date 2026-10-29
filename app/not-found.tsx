import Link from "next/link";

export default function NotFound() {
  return (
    <section className="rounded-2xl border border-ink/5 bg-card px-8 py-20 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-3 text-2xl font-bold">这条热搜暂未找到</h1>
      <p className="mt-3 text-sm text-muted">可能还在准备中，也可能链接有误。回榜单继续逛逛吧。</p>
      <Link href="/trending" className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-card">返回热搜榜</Link>
    </section>
  );
}
