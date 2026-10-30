"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FriendProfile } from "@/lib/friend-schema";
import { CHAT_HISTORY_MAX_LENGTH, CHAT_MESSAGE_MAX_LENGTH, ChatResponseSchema, chatErrorMessage, type ChatHistoryEntry } from "@/lib/chat-contract";
import { FriendAvatar } from "./FriendAvatar";

export function FriendChat({ friend }: { friend: FriendProfile }) {
  const [messages, setMessages] = useState<ChatHistoryEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ status: number; text: string } | null>(null);
  const active = useRef<AbortController | null>(null);
  const latest = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // React 路由暂存后重新显示时，清除已取消请求的等待状态。
    setPending(null);
    return () => { active.current?.abort(); active.current = null; };
  }, []);
  useEffect(() => { latest.current?.scrollIntoView?.({ block: "nearest" }); }, [messages, pending, error]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || message.length > CHAT_MESSAGE_MAX_LENGTH || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(message);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: friend.id, message, history: messages.slice(-CHAT_HISTORY_MAX_LENGTH) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (!controller.signal.aborted) setError({ status: response.status, text: chatErrorMessage(response.status) });
        return;
      }
      const result = ChatResponseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      setMessages((previous) => [...previous, { role: "user", content: message }, { role: "assistant", content: result.reply }]);
      setDraft("");
    } catch {
      if (!controller.signal.aborted) setError({ status: 502, text: chatErrorMessage(502) });
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPending(null);
      }
    }
  }

  function bubble(message: ChatHistoryEntry, key: string | number) {
    return <li key={key} className={`chat-message chat-message-${message.role}`}>
      {message.role === "assistant" ? <FriendAvatar avatar={friend.avatar} /> : <span className="chat-self-avatar">我</span>}
      <div className="chat-message-copy">{message.role === "assistant" && <span className="chat-sender">{friend.name}</span>}<p className="chat-bubble">{message.content}</p></div>
    </li>;
  }

  return <section className="friend-chat" aria-labelledby="friend-chat-heading">
    <div className="chat-profile"><FriendAvatar avatar={friend.avatar} /><div><h1 id="friend-chat-heading">{friend.name}</h1><p>{friend.bio}</p></div></div>
    <p className="chat-role-note">这是角色扮演，史实以给定资料为准。</p>
    <div className="chat-transcript" role="log" aria-label={`与${friend.name}的对话`} aria-live="polite" aria-relevant="additions text">
      <p className="chat-session-note">此刻的闲谈 · 仅在本页暂存</p>
      <ol>
        {bubble({ role: "assistant", content: friend.greeting }, "greeting")}
        {messages.map((message, index) => bubble(message, index))}
        {pending && bubble({ role: "user", content: pending }, "pending")}
      </ol>
      {pending && <p className="chat-waiting" role="status">{friend.name}正在回信…</p>}
      {error && <div className="chat-error" role="alert"><p className="chat-error-title">{error.status === 503 ? "好友暂时不在线" : "这封信稍等一会儿"}</p><p>{error.text}</p><button type="button" onClick={() => void send()} disabled={Boolean(pending)}>重试发送</button></div>}
      <div ref={latest} />
    </div>
    <form className="chat-composer" aria-label="发送消息" onSubmit={(event) => void send(event)}>
      <div className="chat-composer-label"><label htmlFor="chat-message">写给{friend.name}</label><span id="chat-message-count">{draft.length}/{CHAT_MESSAGE_MAX_LENGTH}</span></div>
      <div className="chat-composer-fields">
        <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={CHAT_MESSAGE_MAX_LENGTH} disabled={Boolean(pending)} rows={2} placeholder="想说什么，慢慢写…" aria-describedby="chat-message-count" />
        <button type="submit" disabled={!draft.trim() || Boolean(pending)} aria-label="发送消息"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="m5 15 7-8 7 8M12 7v14M5 3h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg><span>发送</span></button>
      </div>
    </form>
  </section>;
}
