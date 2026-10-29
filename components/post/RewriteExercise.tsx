"use client";

import type { RewriteOption } from "@/lib/schemas";

export function RewriteExercise({ options, selectedId, onSelect }: {
  options: RewriteOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const selected = options.find((option) => option.id === selectedId);
  const best = options.find((option) => option.isBest)!;

  return (
    <section className="panel" aria-labelledby="rewrite-heading">
      <p className="eyebrow">把瓜讲准确</p>
      <h2 id="rewrite-heading" className="text-lg font-bold">换你来写一个更严谨的版本</h2>
      <p className="mt-2 text-sm text-muted">可选练习，选完看反馈，也可以直接生成查证卡。</p>
      <div className="mt-5 space-y-3" role="group" aria-label="三选一改写">
        {options.map((option) => (
          <button key={option.id} type="button" aria-label={`${option.id} ${option.text}`} aria-pressed={selectedId === option.id} onClick={() => onSelect(option.id)}
            className={`rewrite-option ${selectedId === option.id ? "border-accent bg-accent/5" : "border-ink/10 hover:border-gold"}`}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background font-bold">{option.id}</span>
            <span>{option.text}</span>
          </button>
        ))}
      </div>
      {selected && (
        <div role="status" className="mt-5 rounded-xl border border-gold/40 bg-gold/10 p-5 text-sm leading-7">
          <p className="font-bold">{selected.isBest ? "改写正确，这样说更准确。" : "再打磨一下，看看遗漏了什么。"}</p>
          <p className="mt-1">{selected.feedback}</p>
          <p className="mt-2"><strong>正确项：{best.id}</strong> · {best.text}</p>
        </div>
      )}
    </section>
  );
}
