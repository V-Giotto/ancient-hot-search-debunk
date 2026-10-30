"use client";

import { useEffect, useRef, useState } from "react";
import { AskPanel } from "@/components/ai/AskPanel";
import { readCollectionProgress, saveProgress } from "@/lib/progress";
import type { PublicTopic } from "@/lib/public-topic";
import type { VerdictResult } from "@/lib/verdict";
import Link from "next/link";
import { getSticker } from "@/lib/stickers";
import { StickerBadge } from "@/components/stickers/StickerBadge";
import { useCollectionProgress } from "@/components/progress/useCollectionProgress";
import { CheckCardDialog } from "./CheckCardDialog";
import { RewriteExercise } from "./RewriteExercise";
import { VerdictReveal } from "./VerdictReveal";

async function requestVerdict(topicId: string, answer: boolean, signal: AbortSignal): Promise<VerdictResult> {
  const response = await fetch("/api/verdict", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicId, answer }), cache: "no-store", signal,
  });
  if (!response.ok) throw new Error("判题暂时不可用，请重试。");
  return response.json();
}

export function VerdictTask({ topic, topicIds, onReplay, collectedTopics }: {
  topic: PublicTopic; topicIds: readonly string[]; onReplay?: () => void; collectedTopics?: Set<string>;
}) {
  const collectionProgress = useCollectionProgress(topicIds);
  const [answer, setAnswer] = useState<boolean>();
  const [result, setResult] = useState<VerdictResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [rewriteId, setRewriteId] = useState<string>();
  const [showCard, setShowCard] = useState(false);
  const [earnedProgress, setEarnedProgress] = useState<{ completed: number; total: number; firstUnlock: boolean }>();
  const localCollectionRef = useRef(new Set<string>());
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const revealHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusRevealRef = useRef(false);

  useEffect(() => {
    if (result && focusRevealRef.current) {
      focusRevealRef.current = false;
      const heading = revealHeadingRef.current;
      heading?.focus({ preventScroll: true });
      heading?.closest(".reveal-panel")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    }
  }, [result]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submit() {
    if (typeof answer !== "boolean" || pendingRef.current || busy || result) return;
    pendingRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const data = await requestVerdict(topic.id, answer, controller.signal);
      if (controller.signal.aborted) return;
      focusRevealRef.current = true;
      setResult(data);
      const collection = readCollectionProgress(topicIds);
      const collected = collectedTopics ?? localCollectionRef.current;
      const firstUnlock = !collection.completedIds.includes(topic.id) && !collected.has(topic.id);
      // 兼容旧版已揭晓记录，但不恢复答案/改写；选题和重玩不覆盖持久收集。
      if (!collection.completedIds.includes(topic.id)) {
        const saved = saveProgress({ topicId: topic.id, selectedAnswer: answer, submittedAt: new Date().toISOString(), revealed: true });
        setStorageFailed(!saved);
        if (saved) collected.delete(topic.id);
        else collected.add(topic.id);
      }
      setEarnedProgress({ completed: new Set([...collection.completedIds, ...collected, topic.id].filter((id) => topicIds.includes(id))).size, total: collection.total, firstUnlock });
    } catch {
      if (!controller.signal.aborted) setError("判题暂时不可用，请重试。你的选择仍然保留。");
    } finally {
      if (!controller.signal.aborted) {
        pendingRef.current = false;
        controllerRef.current = null;
        setBusy(false);
      }
    }
  }

  const locked = busy || !!result;
  return (
    <>
      <section className="panel task-panel" aria-labelledby="task-heading">
        <p className="eyebrow">辟谣局任务 / {topic.id}</p>
        <h2 id="task-heading" tabIndex={-1} className="text-xl font-bold">这条主张，你信吗？</h2>
        {collectionProgress?.completedIds.includes(topic.id) && <p className="mt-2 text-xs text-muted">贴纸已收藏 · 已查证 {collectionProgress.completedIds.length}/{collectionProgress.total}，重玩不重复累计。</p>}
        <p className="mt-4 text-lg leading-8 font-semibold">{topic.claim}</p>
        <p className="mt-3 text-sm text-muted">只判断这一条史实主张。提交前可以改选，揭晓后可再玩一次。</p>
        <fieldset disabled={locked} className="mt-6">
          <legend className="sr-only">判断主张真假</legend>
          <div className="grid grid-cols-2 gap-3">
            {[{ value: true, label: "是真的", mark: "真" }, { value: false, label: "是假的", mark: "假" }].map((option) => (
              <label key={option.label} className={`answer-option ${answer === option.value ? "answer-selected" : ""} ${locked ? "cursor-default" : "cursor-pointer"}`}>
                <input type="radio" name={`answer-${topic.id}`} value={String(option.value)} checked={answer === option.value} onChange={() => setAnswer(option.value)} />
                <span className="text-xl font-bold" aria-hidden="true">{option.mark}</span><span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {!result && <button type="button" className="primary-button" disabled={typeof answer !== "boolean" || busy} onClick={submit}>
            {busy ? "正在查证…" : "提交判断"}
          </button>}
          <p className="text-xs text-muted">{result ? "答案已锁定，可继续查看依据与改写。" : "查证结果将在提交后揭晓。"}</p>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-accent">{error}</p>}
        {storageFailed && <p role="status" className="mt-3 text-xs text-muted">本机存储不可用，本次可继续体验；刷新后进度可能无法保留。</p>}
      </section>
      {result && <>
        <VerdictReveal result={result} headingRef={revealHeadingRef}>
          <section className="sticker-earned" aria-label="本题贴纸" aria-live="polite" aria-atomic="true">
            <StickerBadge sticker={getSticker(topic.id)} unlocked />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-6 font-semibold">{earnedProgress?.firstUnlock
                ? `获得贴纸：${getSticker(topic.id).name} · 已查证 ${earnedProgress.completed}/${earnedProgress.total}`
                : `${getSticker(topic.id).name} · 已收藏`}</p>
              {storageFailed && <p className="text-xs text-muted">本次已解锁，存储不可用时刷新可能丢失。</p>}
              <Link href="/me?tab=stickers" className="text-xs text-accent hover:underline">去贴纸墙 →</Link>
            </div>
          </section>
        </VerdictReveal>
        {onReplay && <button type="button" className="secondary-button" onClick={onReplay}>再玩一次</button>}
        <AskPanel key={topic.id} topicId={topic.id} reviewStatus={topic.reviewStatus} sources={result.sources} />
        <RewriteExercise options={result.rewriteOptions} selectedId={rewriteId} onSelect={setRewriteId} />
        <section className="panel flex flex-wrap items-center justify-between gap-5">
          <div><h2 className="font-bold">把这次查证带走</h2><p className="mt-2 text-sm text-muted">生成一张有结论、有来源的查证卡。</p></div>
          <button type="button" onClick={() => setShowCard(true)} className="primary-button">生成查证卡</button>
        </section>
        {showCard && <CheckCardDialog topic={topic} result={result} onClose={() => setShowCard(false)} />}
      </>}
    </>
  );
}
