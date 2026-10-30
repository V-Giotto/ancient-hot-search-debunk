"use client";

import { PixelIcon } from "@/components/pixel/PixelIcon";

import { useEffect, useRef, useState } from "react";
import {
  AskResponseSchema, HISTORY_CONTENT_MAX_LENGTH, HISTORY_MAX_LENGTH, QUESTION_MAX_LENGTH,
  type AskHistoryEntry, type AskResponse,
} from "@/lib/ask-contract";
import type { HotTopic, Source } from "@/lib/schemas";
import { getContentReviewStatus } from "@/lib/review-status";
import { validateSourceIds } from "@/lib/source-guard";

const PRESET_QUESTIONS = [
  "唐朝人到底用什么调料获得辛辣味？",
  "胡椒和辣椒是一回事吗？",
  "你凭什么说辣椒是明代才传入？",
];

const ERROR_MESSAGES: Record<number, string> = {
  400: "请输入 1–500 字的问题。",
  404: "未找到这条热搜",
  409: "本条内容审核中，暂不开放追问",
  429: "提问太快了，请稍后再试。",
  502: "AI 服务暂时不可用，请稍后重试。",
  503: "AI 未配置",
  504: "AI 回答超时，请重试；你的问题仍然保留。",
};

type Exchange = { question: string; response: AskResponse };

export function AskPanel({ topicId, reviewStatus, sources }: { topicId: string; reviewStatus: HotTopic["reviewStatus"]; sources: Source[] }) {
  const [input, setInput] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const busy = !!pendingQuestion;
  const allowedSources = sources.filter((source) => source.status !== "rejected" && /^https?:\/\//.test(source.url));
  const pendingContent = getContentReviewStatus(reviewStatus, allowedSources) === "pending";

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function send(text: string) {
    const question = text.trim();
    if (controllerRef.current || !question || question.length > QUESTION_MAX_LENGTH) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setInput(text);
    setPendingQuestion(question);
    setError("");
    const history: AskHistoryEntry[] = exchanges.flatMap(({ question: previousQuestion, response }) => [
      { role: "user" as const, content: previousQuestion },
      { role: "assistant" as const, content: response.answer.slice(0, HISTORY_CONTENT_MAX_LENGTH) },
    ]).slice(-HISTORY_MAX_LENGTH);
    try {
      const response = await fetch("/api/ask", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ topicId, question, history }), signal: controller.signal,
      });
      if (!response.ok) {
        if (!controller.signal.aborted) setError(ERROR_MESSAGES[response.status] || "AI 暂时无法回答，请稍后重试。");
        return;
      }
      const data = AskResponseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      setExchanges((previous) => [...previous, { question, response: data }]);
      setInput("");
    } catch {
      if (!controller.signal.aborted) setError("AI 请求失败，请检查网络后重试；你的问题仍然保留。");
    } finally {
      if (!controller.signal.aborted) setPendingQuestion("");
      controllerRef.current = null;
    }
  }

  return (
    <section className="panel" aria-labelledby="ask-heading">
      <p className="eyebrow">AI 追问 / 辟谣局值班史官</p>
      <h2 id="ask-heading" tabIndex={-1} className="text-xl font-bold">这条热搜，还想问什么？</h2>
      <p className="mt-3 text-sm leading-7 text-muted">围绕本条资料继续追问。AI 生成，可能有误，以史料为准。</p>
      <div className="mt-5 grid gap-2" aria-label="预设问题">
        {PRESET_QUESTIONS.map((question) => (
          <button key={question} type="button" className="secondary-button w-full justify-start text-left disabled:opacity-50" disabled={busy} onClick={() => void send(question)}>{question}</button>
        ))}
      </div>
      <div role="log" aria-label="AI 问答记录" aria-live="polite" aria-busy={busy} className="mt-6 space-y-5">
        {exchanges.map(({ question, response }, index) => {
          const ids = validateSourceIds(response.citedSourceIds, allowedSources.map((source) => source.id));
          return (
            <div key={index} className="space-y-3">
              <p className="ml-8 rounded-xl bg-gold/15 p-4 text-sm leading-7 break-words"><span className="font-semibold">你：</span>{question}</p>
              <div className="mr-4 rounded-xl border border-ink/10 bg-background p-4 text-sm leading-7 break-words">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">值班史官 · AI</span>
                  {response.preview && <span className="rounded bg-gold/20 px-2 text-xs text-[#7d5b32]">{pendingContent ? "开发预览·资料待审核" : "开发预览"}</span>}
                </div>
                <p className="mt-2 whitespace-pre-wrap">{response.answer}</p>
                {ids.length > 0 && <ul className="mt-3 space-y-2" aria-label="本条回答引用">
                  {ids.map((id) => {
                    const source = allowedSources.find((item) => item.id === id)!;
                    return <li key={id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{source.title} <PixelIcon name="external" size={16} /></a></li>;
                  })}
                </ul>}
              </div>
            </div>
          );
        })}
        {busy && <div role="status" className="rounded-xl bg-background p-4 text-sm leading-7"><p className="break-words">你：{pendingQuestion}</p><p className="mt-2 text-muted">值班史官正在查阅资料…</p></div>}
      </div>
      <form className="mt-5" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
        <label htmlFor="ask-question" className="text-sm font-semibold">向值班史官提问</label>
        <textarea id="ask-question" value={input} onChange={(event) => setInput(event.target.value)} maxLength={QUESTION_MAX_LENGTH} disabled={busy} rows={3}
          aria-describedby="ask-input-limit" className="mt-2 block w-full resize-y rounded-xl border border-ink/20 bg-white p-3 text-base leading-7 disabled:opacity-60" placeholder="输入你对本条热搜的疑问" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p id="ask-input-limit" className="text-xs text-muted">{input.length}/{QUESTION_MAX_LENGTH} 字；仅围绕当前热搜</p>
          <button type="submit" className="primary-button" disabled={busy || !input.trim() || input.trim().length > QUESTION_MAX_LENGTH}>{busy ? "回答中…" : "发送问题"}</button>
        </div>
      </form>
      {error && <div className="mt-4 rounded-xl border border-accent/20 p-4">
        <p role="alert" className="text-sm leading-7 text-accent">{error}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="secondary-button" disabled={busy || !input.trim()} onClick={() => void send(input)}>重试提问</button>
          <a href="#reveal-heading" className="secondary-button" onClick={() => document.getElementById("reveal-heading")?.focus({ preventScroll: true })}>返回揭晓</a>
        </div>
      </div>}
    </section>
  );
}
