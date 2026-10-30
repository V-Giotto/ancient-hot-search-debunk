"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { COMMENT_CAPACITY, COMMENT_LIMIT, commentStorageKey, parseLocalComments, removeLocalComment, updateLocalComments, validateComment, type LocalComment } from "@/lib/local-comments";

type Target = { id: string; author: string };
const LocalContext = createContext<{ comments: LocalComment[]; reply: (target: Target) => void; remove: (id: string) => void }>({ comments: [], reply: () => {}, remove: () => {} });

export function ReplyButton({ id, author }: Target) {
  const { reply } = useContext(LocalContext);
  return <button type="button" className="comment-text-button" aria-label={`回复${author}：${id}`} onClick={() => reply({ id, author })}>回复</button>;
}

export function LocalReplies({ parentId = null }: { parentId?: string | null }) {
  const { comments, remove } = useContext(LocalContext);
  const children = comments.filter((comment) => comment.parentId === parentId);
  if (!children.length) return null;
  return <ol className="local-replies" aria-label={parentId ? "本机回复" : "本机评论"}>{children.map((comment) => <li key={comment.id} data-local-id={comment.id}>
    <p className="local-comment-byline"><strong>我</strong><span>仅保存在本机</span></p>
    <p className="local-comment-text">{comment.text}</p>
    <div className="local-comment-actions"><ReplyButton id={comment.id} author="我" /><button type="button" className="comment-text-button" aria-label={`删除自己的评论：${comment.text}`} onClick={() => remove(comment.id)}>删除</button></div>
    <LocalReplies parentId={comment.id} />
  </li>)}</ol>;
}

export function LocalDiscussion({ contentId, presetIds, children }: { contentId: string; presetIds: readonly string[]; children: ReactNode }) {
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [target, setTarget] = useState<Target | null>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const key = commentStorageKey(contentId);

  useEffect(() => {
    const read = () => { try { setComments(parseLocalComments(localStorage.getItem(key), presetIds)); } catch { setComments([]); } };
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === key) read(); };
    const onUpdate = (event: Event) => { if ((event as CustomEvent).detail === key) read(); };
    read();
    window.addEventListener("storage", onStorage);
    window.addEventListener("ahsd:comments-updated", onUpdate);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("ahsd:comments-updated", onUpdate); };
  }, [key, presetIds]);

  useEffect(() => {
    if (target === undefined) return;
    inputRef.current?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [target]);

  function open(next: Target | null) { setTarget(next); setError(""); setStatus(""); }
  function remove(id: string) {
    try {
      setComments(updateLocalComments(contentId, presetIds, (current) => removeLocalComment(current, id)));
      setStatus("已删除这条评论及其本机回复。"); setError("");
    } catch { setError("本机存储不可用，未能删除。请重试。"); }
  }
  function save() {
    const invalid = validateComment(draft);
    if (invalid) { setError(invalid); return; }
    try {
      setComments(updateLocalComments(contentId, presetIds, (current) => {
        if (current.length >= COMMENT_CAPACITY) throw new Error("capacity");
        if (target && !presetIds.includes(target.id) && !current.some(({ id }) => id === target.id)) throw new Error("parent");
        return [...current, { id: `local-${crypto.randomUUID()}`, parentId: target?.id ?? null, text: draft.trim(), createdAt: new Date().toISOString() }];
      }));
      setDraft(""); setTarget(undefined); setError(""); setStatus("已保存 · 仅保存在本机");
    } catch { setError("未能保存。请检查本机存储、回复对象，或删除一些旧评论后重试；草稿已保留。"); }
  }

  return <LocalContext value={{ comments, reply: open, remove }}>
    {children}
    <LocalReplies />
    <div className="local-discussion-footer">
      <button type="button" className="secondary-button" onClick={() => open(null)}>写本机评论</button>
      <p className="text-xs text-muted">仅保存在本机</p>
    </div>
    {target !== undefined && <form ref={formRef} className="local-comment-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <label htmlFor={`local-comment-${contentId}`}>{target ? `回复 ${target.author}` : "写本机评论"}</label>
      <textarea ref={inputRef} id={`local-comment-${contentId}`} aria-describedby={`local-limit-${contentId}`} value={draft} maxLength={COMMENT_LIMIT} rows={3} onChange={(event) => { setDraft(event.target.value); setError(""); }} />
      <p id={`local-limit-${contentId}`} className="text-xs text-muted">{draft.length}/{COMMENT_LIMIT} 字 · 仅保存在本机</p>
      <div className="local-comment-actions"><button className="primary-button" type="submit">保存{target ? "回复" : "评论"}</button><button className="secondary-button" type="button" onClick={() => { setTarget(undefined); setDraft(""); setError(""); }}>取消</button></div>
    </form>}
    {error && <p role="alert" className="text-sm text-accent">{error}</p>}
    <p role="status" className="text-xs text-muted">{status}</p>
  </LocalContext>;
}
