"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicTopic } from "@/lib/public-topic";
import { Body } from "./Shared";

const options = [
  { id: "same", label: "直觉：同一部书", tendency: "少数倾向" },
  { id: "different", label: "直觉：两部书", tendency: "多数倾向" },
] as const;
type Choice = typeof options[number]["id"];

export function Poll({ topic }: { topic: PublicTopic }) {
  const [choice, setChoice] = useState<Choice>();
  const [ready, setReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const continueAfterVote = useRef(false);
  const storageKey = `ahsd:poll:v1:${topic.id}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "same" || saved === "different") setChoice(saved);
    } catch { setStorageFailed(true); }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!choice || !continueAfterVote.current) return;
    continueAfterVote.current = false;
    const heading = document.getElementById("task-heading");
    heading?.focus({ preventScroll: true });
    heading?.closest(".task-panel")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }, [choice]);

  function vote(value: Choice) {
    if (choice) return;
    continueAfterVote.current = true;
    setChoice(value);
    try { localStorage.setItem(storageKey, value); } catch { setStorageFailed(true); }
  }

  return <>
      <div className="mt-5 grid grid-cols-2 gap-2 text-center text-sm font-bold"><p className="rounded-xl bg-gold/15 p-4">《孙子兵法》</p><p className="rounded-xl bg-[#426b58]/10 p-4">《孙膑兵法》</p></div>
      <section aria-label="直觉投票" className="mt-4 rounded-xl border border-ink/10 p-4">
        <h2 className="font-bold">先投直觉，再查证</h2>
        <p className="mt-2 text-xs leading-6 text-muted">投票后展示预设倾向；选择仅保存在本机，不影响真假判题与贴纸。</p>
        <div className="mt-3 space-y-3">{options.map((option) => <button key={option.id} type="button" disabled={!ready || !!choice} aria-pressed={choice === option.id} onClick={() => vote(option.id)} className="relative block min-h-12 w-full overflow-hidden rounded-lg border border-ink/15 px-3 py-3 text-left text-sm disabled:cursor-default">
          <span className="flex flex-wrap items-center justify-between gap-2"><span>{option.label}{choice === option.id ? " ✓" : ""}</span>{choice && <span className="poll-tendency">{option.tendency}</span>}</span>
        </button>)}</div>
        {choice && <p role="status" className="mt-3 text-xs text-muted">已投票 · 预设倾向不随投票变化，请继续查证。</p>}
        {storageFailed && <p role="status" className="mt-3 text-xs text-muted">本机存储不可用，本次仍可投票与判题；刷新后选择可能丢失。</p>}
        <a href="#task-heading" className="mt-3 text-sm font-semibold text-accent">继续判断真假 ↓</a>
      </section><Body topic={topic} />
  </>;
}
