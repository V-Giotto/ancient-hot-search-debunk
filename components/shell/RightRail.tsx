import Link from "next/link";

function Announcement() {
  return <p className="briefing-text">每条话题都有一条待判断的主张。提交后可查看结论与来源，也能收集一枚主题贴纸。</p>;
}

function Rules() {
  return <ol className="briefing-rules">
    <li><span>01</span>标题可以有梗，结论要看证据。</li>
    <li><span>02</span>查阅来源，留意时间与范围。</li>
    <li><span>03</span>有过个例，不等于人人都有。</li>
  </ol>;
}

export function LeftRail() {
  return <aside aria-label="辟谣局公告侧栏" className="desktop-rail left-rail">
    <p className="rail-eyebrow">辟谣局 / 告示栏</p>
    <section className="rail-card">
      <p className="rail-number" aria-hidden="true">NOTICE · 01</p>
      <h2>辟谣局公告</h2>
      <Announcement />
      <div className="rail-process"><span>判断</span><span aria-hidden="true">→</span><span>查证</span><span aria-hidden="true">→</span><span>收集</span></div>
    </section>
    <p className="rail-note">让历史因为一个梗被点开，<br />因为一个证据被记住。</p>
  </aside>;
}

export function RightRail() {
  return <aside aria-label="今天的吃瓜守则侧栏" className="desktop-rail right-rail">
    <p className="rail-eyebrow">围观之前 / 先读三条</p>
    <section className="rail-card">
      <p className="rail-number" aria-hidden="true">READ FIRST · 03</p>
      <h2>今天的吃瓜守则</h2>
      <Rules />
    </section>
    <Link href="/stickers" className="rail-stickers"><span><strong>本机贴纸档案</strong><small>每次查证，留下一枚印记。</small></span><span aria-hidden="true">↗</span></Link>
    <p className="rail-note">仅保存在本机，随时回来重温。</p>
  </aside>;
}

export function MobileBriefing() {
  return <aside aria-label="页内公告与守则" className="mobile-briefing">
    <details><summary>辟谣局公告</summary><Announcement /></details>
    <details><summary>今天的吃瓜守则</summary><Rules /></details>
  </aside>;
}
