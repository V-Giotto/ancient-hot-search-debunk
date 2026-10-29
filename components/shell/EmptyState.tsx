export function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gold/50 bg-card px-8 py-20 text-center">
      <span aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-background text-2xl text-gold">#</span>
      <h2 className="mt-5 text-lg font-semibold">热搜还在准备中</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted">
        先让好奇心歇一会儿，辟谣局正在整理内容。<br />题目与史料准备好后，会在这里和你见面。
      </p>
    </div>
  );
}
