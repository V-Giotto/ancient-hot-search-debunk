import type { ReactNode, Ref } from "react";
import type { VerdictResult } from "@/lib/verdict";
import { StatusIcon } from "@/components/social/StatusIcon";

export function VerdictReveal({ result, headingRef, children }: { result: VerdictResult; headingRef?: Ref<HTMLHeadingElement>; children?: ReactNode }) {
  return (
    <section className="panel reveal-panel" aria-labelledby="reveal-heading">
      <p className="eyebrow">查证结果 · 开发预览</p>
      <h2 ref={headingRef} id="reveal-heading" tabIndex={-1} className="text-xl font-bold">{result.reveal.verdictHeadline}</h2>
      <div className="verdict-stamp-row">
        <span className={`verdict-stamp ${result.isTrue ? "stamp-true" : ""}`}>
          <StatusIcon name={result.isTrue ? "verified" : "refuted"} size={28} />
          <span>{result.isTrue ? "查证属实" : "谣言退散"}</span>
          <span className="sr-only">，核心主张为{result.isTrue ? "真" : "假"}。</span>
        </span>
      </div>
      <p role="status" className={`verdict-feedback ${result.isCorrect ? "feedback-correct" : "feedback-incorrect"}`}>
        <span aria-hidden="true" className="verdict-feedback-icon">{result.isCorrect ? "✓" : "✕"}</span>
        <span>{result.isCorrect ? "答对了！这次吃瓜有依据。" : "这次答错了，带走一个新知识。"}</span>
      </p>
      <section className="corrected-claim mt-4 rounded-xl border-l-4 border-gold bg-gold/10 p-4">
        <h3 className="result-heading">准确说法</h3>
        <p className="mt-2 text-sm leading-7 font-medium">{result.reveal.correctedClaim}</p>
      </section>
      <a href="#ask-heading" className="secondary-button mt-4" onClick={() => document.getElementById("ask-heading")?.focus({ preventScroll: true })}>问问 AI</a>
      {children}
      <div className="reveal-details mt-4 text-sm leading-7">
        <details>
          <summary>为什么</summary>
          <p className="mt-2">{result.reveal.shortExplanation}</p>
          <p className="mt-3 text-muted">{result.reveal.detailedExplanation}</p>
        </details>
        <details>
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
        <details>
          <summary>延伸冷知识</summary>
          <p className="mt-2">{result.reveal.funFact}</p>
        </details>
      </div>
    </section>
  );
}
