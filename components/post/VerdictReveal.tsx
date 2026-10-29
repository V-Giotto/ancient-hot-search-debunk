import type { Ref } from "react";
import type { VerdictResult } from "@/lib/verdict";

export function VerdictReveal({ result, revisiting, headingRef }: { result: VerdictResult; revisiting: boolean; headingRef?: Ref<HTMLHeadingElement> }) {
  return (
    <section className="panel reveal-panel" aria-labelledby="reveal-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">查证结果 · 开发预览</p>
          <h2 ref={headingRef} id="reveal-heading" tabIndex={-1} className="text-xl font-bold">{result.reveal.verdictHeadline}</h2>
        </div>
        <span className={`verdict-stamp ${result.isTrue ? "stamp-true" : ""}`}>{result.isTrue ? "查证属实" : "谣言退散"}</span>
      </div>
      <p role="status" className="mt-5 text-sm text-muted">{revisiting ? "重温本条 · 已恢复上次答案，不重复计分。" : result.isCorrect ? "答对了！这次吃瓜有依据。" : "这次答错了，带走一个新知识。"}</p>
      <div className="mt-6 space-y-6 leading-8">
        <section><h3 className="result-heading">01 · 明确答案</h3><p className="mt-2 font-medium">核心主张为{result.isTrue ? "真" : "假"}。</p></section>
        <section>
          <h3 className="result-heading">02 · 为什么</h3>
          <p className="mt-2 text-sm leading-8">{result.reveal.shortExplanation}</p>
          <details className="mt-3 text-sm"><summary>展开详细解释</summary><p className="mt-3 text-muted">{result.reveal.detailedExplanation}</p></details>
        </section>
        <section className="rounded-xl border-l-4 border-gold bg-gold/10 p-5">
          <h3 className="result-heading">03 · 准确说法</h3><p className="mt-2 font-medium">{result.reveal.correctedClaim}</p>
        </section>
        <section>
          <h3 className="result-heading">04 · 史料依据</h3>
          <details className="mt-2 text-sm">
            <summary>展开史料依据（{result.sources.length} 条）</summary>
            <ul className="mt-4 space-y-4">
              {result.sources.map((source) => (
                <li key={source.id} className="rounded-xl border border-ink/10 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{source.organization}</span>
                    <span className="rounded-md bg-gold/15 px-2 text-[#7d5b32]">待人工审核</span>
                    <span className="text-muted">{source.id}</span>
                  </div>
                  <a href={source.url} target="_blank" rel="noopener" className="mt-1 block font-semibold text-accent hover:underline">{source.title} ↗</a>
                  <p className="mt-2 leading-7 text-muted">支持要点：{source.supports}</p>
                </li>
              ))}
            </ul>
          </details>
        </section>
        <section><h3 className="result-heading">05 · 延伸冷知识</h3><p className="mt-2 text-sm leading-8">{result.reveal.funFact}</p></section>
      </div>
    </section>
  );
}
