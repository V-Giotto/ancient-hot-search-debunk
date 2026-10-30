export function RightRail() {
  return (
    <aside aria-label="辟谣局信息" className="mt-8 min-w-0 space-y-3">
      <details className="rounded-2xl border border-ink/5 bg-card px-4 py-2">
        <summary className="text-sm">辟谣局公告</summary>
        <p className="mt-2 pb-3 text-sm leading-7 text-muted">
          每条热搜都有一条待判断的主张。提交后可查看结论与来源，也能收集一枚主题贴纸。
        </p>
      </details>
      <details className="rounded-2xl border border-ink/5 bg-card px-4 py-2">
        <summary className="text-sm">今天的吃瓜守则</summary>
        <ol className="mt-2 space-y-3 pb-3 text-sm leading-6">
          <li><span className="mr-2 text-gold">01</span>标题可以有梗，结论要看证据。</li>
          <li><span className="mr-2 text-gold">02</span>查阅来源，留意时间与范围。</li>
          <li><span className="mr-2 text-gold">03</span>有过个例，不等于人人都有。</li>
        </ol>
      </details>
      <p className="px-2 text-xs leading-6 text-muted">让历史因为一个梗被点开，因为一个证据被记住。</p>
    </aside>
  );
}
