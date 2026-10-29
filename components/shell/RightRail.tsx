export function RightRail() {
  return (
    <aside aria-label="辟谣局信息栏" className="shell-right-rail shell-sticky-rail min-w-0 space-y-5">
      <section className="rounded-2xl border border-ink/5 bg-card p-6">
        <p className="mb-3 text-xs font-medium tracking-widest text-accent">来自辟谣局</p>
        <h2 className="text-base font-bold">辟谣局公告</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          本站是古代社交媒体的架空演绎。角色发言、评论与热度均为创作，不是历史人物原话或真实热榜。
        </p>
      </section>
      <section className="rounded-2xl border border-ink/5 bg-card p-6">
        <h2 className="text-base font-bold">今天的吃瓜守则</h2>
        <ol className="mt-4 space-y-4 text-sm leading-6">
          <li><span className="mr-2 text-gold">01</span>标题可以有梗，结论要看证据。</li>
          <li><span className="mr-2 text-gold">02</span>现代类比，不等于古代原貌。</li>
          <li><span className="mr-2 text-gold">03</span>有过个例，不等于人人都有。</li>
        </ol>
      </section>
      <p className="px-2 text-xs leading-6 text-muted">让历史因为一个梗被点开，<br />因为一个证据被记住。</p>
    </aside>
  );
}
