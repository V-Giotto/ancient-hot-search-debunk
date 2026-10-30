export function RightRail() {
  return (
    <aside aria-label="辟谣局信息" className="mt-8 min-w-0 space-y-3">
      <details className="rounded-2xl border border-ink/5 bg-card px-4 py-2">
        <summary className="text-sm">辟谣局公告</summary>
        <p className="mt-2 pb-3 text-sm leading-7 text-muted">
          本站是古代社交媒体的架空演绎。角色发言、评论与热度均为创作，不是历史人物原话或真实热榜。
        </p>
      </details>
      <details className="rounded-2xl border border-ink/5 bg-card px-4 py-2">
        <summary className="text-sm">今天的吃瓜守则</summary>
        <ol className="mt-2 space-y-3 pb-3 text-sm leading-6">
          <li><span className="mr-2 text-gold">01</span>标题可以有梗，结论要看证据。</li>
          <li><span className="mr-2 text-gold">02</span>现代类比，不等于古代原貌。</li>
          <li><span className="mr-2 text-gold">03</span>有过个例，不等于人人都有。</li>
        </ol>
      </details>
      <p className="px-2 text-xs leading-6 text-muted">热度是模拟的，对历史的好奇是真的。<br />让历史因为一个梗被点开，因为一个证据被记住。</p>
    </aside>
  );
}
