"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { FriendProfile } from "@/lib/friend-schema";
import { CHAT_HISTORY_MAX_LENGTH, CHAT_MESSAGE_MAX_LENGTH, ChatResponseSchema, chatErrorMessage, type ChatHistoryEntry } from "@/lib/chat-contract";
import { CHAT_STORAGE_MAX_ENTRIES, readChatHistory, saveChatHistory, type SharedTopic, type ShareEntry, type StoredChatEntry } from "@/lib/chat-storage";
import { SocialIcon } from "@/components/social/SocialIcon";
import { FriendAvatar } from "./FriendAvatar";

type IncomingShare = { token: string; topic: SharedTopic };
export function FriendChat({ friend, incomingShare }: { friend: FriendProfile; incomingShare?: IncomingShare }) {
  const [messages, setMessages] = useState<StoredChatEntry[]>([]);
  const messagesRef = useRef<StoredChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<{ status: number; text: string } | null>(null);
  const active = useRef<AbortController | null>(null);
  const latest = useRef<HTMLDivElement>(null);
  const clearedShares = useRef(new Set<string>());
  const shareKey = incomingShare?.token;
  const incomingRef = useRef(incomingShare);
  incomingRef.current = incomingShare;

  function store(entries: StoredChatEntry[]) {
    const bounded = entries.slice(-CHAT_STORAGE_MAX_ENTRIES);
    messagesRef.current = bounded;
    setMessages(bounded);
    saveChatHistory(friend.id, bounded);
  }
  function history(entries: StoredChatEntry[]) {
    return entries.filter((entry): entry is ChatHistoryEntry => entry.role !== "share").slice(-CHAT_HISTORY_MAX_LENGTH);
  }
  function shareStatus(id: string, status: ShareEntry["status"]) {
    store(messagesRef.current.map((entry) => entry.role === "share" && entry.id === id ? { ...entry, status } : entry));
  }
  async function replyToShare(card: ShareEntry) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setSharing(card.id);
    shareStatus(card.id, "pending");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ friendId: friend.id, sharedTopicId: card.topic.id, message: "我分享了这条见闻，你怎么看？", history: history(messagesRef.current) }),
      });
      if (controller.signal.aborted) return;
      if (!response.ok) { shareStatus(card.id, response.status === 503 ? "offline" : "failed"); return; }
      const result = ChatResponseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      const entries = messagesRef.current.map((entry) => entry.role === "share" && entry.id === card.id ? { ...entry, status: "answered" as const } : entry);
      store([...entries, { role: "assistant", content: result.reply }]);
    } catch { if (!controller.signal.aborted) shareStatus(card.id, "failed"); }
    finally {
      if (active.current === controller) { active.current = null; setSharing(null); }
    }
  }

  useEffect(() => {
    setPending(null); setSharing(null); setError(null);
    const entries = readChatHistory(friend.id);
    const incoming = incomingRef.current;
    if (incoming && !clearedShares.current.has(incoming.token)) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("shareToken")) {
        url.searchParams.delete("shareToken"); url.searchParams.delete("sharedTopicId");
        window.history.replaceState(window.history.state, "", url);
      }
      const existing = entries.find((entry): entry is ShareEntry => entry.role === "share" && entry.id === incoming.token);
      if (!existing) {
        const card: ShareEntry = { role: "share", id: incoming.token, topic: incoming.topic, status: "pending" };
        store([...entries, card]);
        void replyToShare(card);
      } else {
        store(entries);
        if (existing.status === "pending") void replyToShare(existing);
      }
    } else store(entries);
    return () => { active.current?.abort(); active.current = null; };
    // 每次路由重新显示从本机恢复；分享 token 去重，避免刷新重复插卡或请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.id, shareKey]);
  useEffect(() => { latest.current?.scrollIntoView?.({ block: "nearest" }); }, [messages, pending, sharing, error]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || message.length > CHAT_MESSAGE_MAX_LENGTH || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(message); setError(null);
    const shared = messagesRef.current.findLast((entry) => entry.role === "share");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: friend.id, message, history: history(messagesRef.current), ...(shared?.role === "share" ? { sharedTopicId: shared.topic.id } : {}) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (!controller.signal.aborted) setError({ status: response.status, text: chatErrorMessage(response.status) });
        return;
      }
      const result = ChatResponseSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      store([...messagesRef.current, { role: "user", content: message }, { role: "assistant", content: result.reply }]);
      setDraft("");
    } catch {
      if (!controller.signal.aborted) setError({ status: 502, text: chatErrorMessage(502) });
    } finally {
      if (active.current === controller) { active.current = null; setPending(null); }
    }
  }
  function clear() {
    if (shareKey) clearedShares.current.add(shareKey);
    active.current?.abort(); active.current = null;
    setPending(null); setSharing(null); setError(null); setDraft("");
    store([]);
  }
  function bubble(message: StoredChatEntry, key: string | number) {
    if (message.role === "share") return <li key={key} className="chat-message chat-message-user chat-share-message">
      <span className="chat-self-avatar">我</span><div className="chat-message-copy"><Link className="chat-share-card" href={`/post/${message.topic.id}`} aria-label={`分享卡片：${message.topic.title}`}><span><SocialIcon name="repost" />分享 · {message.topic.module === "trending" ? "热搜" : "发现"}</span><strong>{message.topic.title}</strong><small>打开原帖 →</small></Link>
        {message.status === "offline" && <p className="chat-share-status" role="status">好友暂时不在线</p>}
        {message.status === "failed" && <p className="chat-share-status" role="status">暂时没能收到好友的回复</p>}
        {((message.status === "offline" || message.status === "failed") || (message.status === "pending" && sharing !== message.id)) && <button type="button" className="secondary-button" disabled={Boolean(pending || sharing)} onClick={() => void replyToShare(message)}>请好友再看看</button>}
      </div></li>;
    return <li key={key} className={`chat-message chat-message-${message.role}`}>
      {message.role === "assistant" ? <FriendAvatar avatar={friend.avatar} /> : <span className="chat-self-avatar">我</span>}
      <div className="chat-message-copy">{message.role === "assistant" && <span className="chat-sender">{friend.name}</span>}<p className="chat-bubble">{message.content}</p></div>
    </li>;
  }
  const busy = Boolean(pending || sharing);
  return <section className="friend-chat" aria-labelledby="friend-chat-heading">
    <div className="chat-profile"><FriendAvatar avatar={friend.avatar} /><div><h1 id="friend-chat-heading">{friend.name}</h1><p>{friend.bio}</p></div></div>
    <p className="chat-role-note">这是角色扮演，史实以给定资料为准。</p>
    <div className="chat-session-tools"><p>闲谈保存在本机 · 最多 {CHAT_STORAGE_MAX_ENTRIES} 条</p><button type="button" className="secondary-button" onClick={clear} disabled={!messages.length && !busy}>清空对话</button></div>
    <div className="chat-transcript" role="log" aria-label={`与${friend.name}的对话`} aria-live="polite" aria-relevant="additions text">
      <ol>{bubble({ role: "assistant", content: friend.greeting }, "greeting")}{messages.map((message, index) => bubble(message, index))}{pending && bubble({ role: "user", content: pending }, "pending")}</ol>
      {busy && <p className="chat-waiting" role="status">{friend.name}正在回信…</p>}
      {error && <div className="chat-error" role="alert"><p className="chat-error-title">{error.status === 503 ? "好友暂时不在线" : "这封信稍等一会儿"}</p><p>{error.text}</p><button type="button" onClick={() => void send()} disabled={busy}>重试发送</button></div>}
      <div ref={latest} />
    </div>
    <form className="chat-composer" aria-label="发送消息" onSubmit={(event) => void send(event)}>
      <div className="chat-composer-label"><label htmlFor="chat-message">写给{friend.name}</label><span id="chat-message-count">{draft.length}/{CHAT_MESSAGE_MAX_LENGTH}</span></div>
      <div className="chat-composer-fields"><textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={CHAT_MESSAGE_MAX_LENGTH} disabled={busy} rows={2} placeholder="想说什么，慢慢写…" aria-describedby="chat-message-count" />
        <button type="submit" disabled={!draft.trim() || busy} aria-label="发送消息"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="m5 15 7-8 7 8M12 7v14M5 3h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg><span>发送</span></button>
      </div>
    </form>
  </section>;
}
