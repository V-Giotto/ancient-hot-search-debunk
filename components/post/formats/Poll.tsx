"use client";

import { useEffect, useState } from "react";
import type { PublicTopic } from "@/lib/public-topic";
import { Body } from "./Shared";

const options = [
  { id: "same", label: "直觉：同一部书", percent: 42 },
  { id: "different", label: "直觉：两部书", percent: 58 },
] as const;
type Choice = typeof options[number]["id"];

export function Poll({ topic }: { topic: PublicTopic }) {
  const [choice, setChoice] = useState<Choice>();
  const [ready, setReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const storageKey = `ahsd:poll:v1:${topic.id}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "same" || saved === "different") setChoice(saved);
    } catch { setStorageFailed(true); }
    setReady(true);
  }, [storageKey]);

  function vote(value: Choice) {
    if (choice) return;
    setChoice(value);
    try { localStorage.setItem(storageKey, value); } catch { setStorageFailed(true); }
  }

  return <>
      <div className="mt-5 grid grid-cols-2 gap-2 text-center text-sm font-bold"><p className="rounded-xl bg-gold/15 p-4">《孙子兵法》</p><p className="rounded-xl bg-[#426b58]/10 p-4">《孙膑兵法》</p></div>
      <section aria-label="直觉投票" className="mt-4 rounded-xl border border-ink/10 p-4">
        <h2 className="font-bold">先投直觉，再查证</h2>
        <p className="mt-2 text-xs leading-6 text-muted">投票后展示预制比例；选择仅保存在本机，不影响真假判题与贴纸。</p>
        <div className="mt-3 space-y-3">{options.map((option) => <button key={option.id} type="button" disabled={!ready || !!choice} aria-pressed={choice === option.id} onClick={() => vote(option.id)} className="relative block min-h-12 w-full overflow-hidden rounded-lg border border-ink/15 px-3 py-3 text-left text-sm disabled:cursor-default">
          {choice && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-gold/20" style={{ width: `${option.percent}%` }} />}
          <span className="relative flex flex-wrap justify-between gap-2"><span>{option.label}{choice === option.id ? " ✓" : ""}</span>{choice && <span>{option.percent}%</span>}</span>
        </button>)}</div>
        {choice && <p role="status" className="mt-3 text-xs text-muted">已投票 · 预制比例不随投票变化</p>}
        {storageFailed && <p role="status" className="mt-3 text-xs text-muted">本机存储不可用，本次仍可投票与判题；刷新后选择可能丢失。</p>}
        <a href="#task-heading" className="mt-3 text-sm font-semibold text-accent">继续判断真假 ↓</a>
      </section><Body topic={topic} />
  </>;
}
