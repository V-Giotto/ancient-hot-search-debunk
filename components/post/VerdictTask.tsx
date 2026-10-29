"use client";

import { useEffect, useRef, useState } from "react";
import { AskPanel } from "@/components/ai/AskPanel";
import { readProgress, saveProgress } from "@/lib/progress";
import type { PublicTopic } from "@/lib/public-topic";
import type { TopicProgress } from "@/lib/schemas";
import type { VerdictResult } from "@/lib/verdict";
import { CheckCardDialog } from "./CheckCardDialog";
import { RewriteExercise } from "./RewriteExercise";
import { VerdictReveal } from "./VerdictReveal";

async function requestVerdict(topicId: string, answer: boolean): Promise<VerdictResult> {
  const response = await fetch("/api/verdict", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicId, answer }), cache: "no-store",
  });
  if (!response.ok) throw new Error("判题暂时不可用，请重试。");
  return response.json();
}

export function VerdictTask({ topic }: { topic: PublicTopic }) {
  const [answer, setAnswer] = useState<boolean>();
  const [result, setResult] = useState<VerdictResult>();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [revisiting, setRevisiting] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [rewriteId, setRewriteId] = useState<string>();
  const [showCard, setShowCard] = useState(false);
  const savedRef = useRef<TopicProgress | undefined>(undefined);
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const saved = readProgress(topic.id);
    savedRef.current = saved;
    if (saved && typeof saved.selectedAnswer === "boolean") {
      setAnswer(saved.selectedAnswer);
      if (saved.revealed) {
        setRevisiting(true);
        setBusy(true);
        requestVerdict(topic.id, saved.selectedAnswer).then((data) => {
          if (!active) return;
          setResult(data);
          setRewriteId(saved.selectedRewriteOptionId);
        }).catch(() => {
          if (!active) return;
          setRestoreFailed(true);
          setError("上次答案已保存，揭晓内容恢复失败，请重试恢复。");
        }).finally(() => { if (active) setBusy(false); });
      }
    }
    setReady(true);
    return () => { active = false; };
  }, [topic.id]);

  function persist(progress: TopicProgress) {
    savedRef.current = progress;
    setStorageFailed(!saveProgress(progress));
  }

  function choose(value: boolean) {
    setAnswer(value);
    persist({ topicId: topic.id, selectedAnswer: value, revealed: false });
  }

  async function submit() {
    if (typeof answer !== "boolean" || pendingRef.current || busy || result) return;
    pendingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await requestVerdict(topic.id, answer);
      setResult(data);
      setRestoreFailed(false);
      if (revisiting) {
        setRewriteId(savedRef.current?.selectedRewriteOptionId);
      } else {
        persist({ topicId: topic.id, selectedAnswer: answer, submittedAt: new Date().toISOString(), revealed: true });
      }
    } catch {
      setError(revisiting ? "揭晓内容恢复失败，请重试恢复。" : "判题暂时不可用，请重试。你的选择仍然保留。");
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  }

  function chooseRewrite(id: string) {
    setRewriteId(id);
    if (savedRef.current) persist({ ...savedRef.current, selectedRewriteOptionId: id });
  }

  const locked = !ready || busy || !!result || revisiting;
  return (
    <>
      <section className="panel task-panel" aria-labelledby="task-heading">
        <p className="eyebrow">辟谣局任务 / {topic.id}</p>
        <h2 id="task-heading" className="text-xl font-bold">这条主张，你信吗？</h2>
        <p className="mt-4 text-lg leading-8 font-semibold">{topic.claim}</p>
        <p className="mt-3 text-sm text-muted">只判断这一条史实主张。提交前可以改选，提交后锁定。</p>
        <fieldset disabled={locked} className="mt-6">
          <legend className="sr-only">判断主张真假</legend>
          <div className="grid grid-cols-2 gap-3">
            {[{ value: true, label: "是真的", mark: "真" }, { value: false, label: "是假的", mark: "假" }].map((option) => (
              <label key={option.label} className={`answer-option ${answer === option.value ? "answer-selected" : ""} ${locked ? "cursor-default" : "cursor-pointer"}`}>
                <input type="radio" name={`answer-${topic.id}`} value={String(option.value)} checked={answer === option.value} onChange={() => choose(option.value)} />
                <span className="text-xl font-bold" aria-hidden="true">{option.mark}</span><span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {!result && <button type="button" className="primary-button" disabled={!ready || typeof answer !== "boolean" || busy} onClick={submit}>
            {busy ? (revisiting ? "正在恢复揭晓…" : "正在查证…") : restoreFailed ? "重试恢复" : "提交判断"}
          </button>}
          <p className="text-xs text-muted">{result ? "答案已锁定，可继续查看依据与改写。" : "查证结果将在提交后揭晓。"}</p>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-accent">{error}</p>}
        {storageFailed && <p role="status" className="mt-3 text-xs text-muted">本机存储不可用，本次可继续体验；刷新后进度可能无法保留。</p>}
      </section>
      {result && <>
        <VerdictReveal result={result} revisiting={revisiting} />
        <AskPanel key={topic.id} topicId={topic.id} sources={result.sources} />
        <RewriteExercise options={result.rewriteOptions} selectedId={rewriteId} onSelect={chooseRewrite} />
        <section className="panel flex flex-wrap items-center justify-between gap-5">
          <div><h2 className="font-bold">把这次查证带走</h2><p className="mt-2 text-sm text-muted">生成一张有结论、有来源的查证卡。</p></div>
          <button type="button" onClick={() => setShowCard(true)} className="primary-button">生成查证卡</button>
        </section>
        {showCard && <CheckCardDialog topic={topic} result={result} onClose={() => setShowCard(false)} />}
      </>}
    </>
  );
}
