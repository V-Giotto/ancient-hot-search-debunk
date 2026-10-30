"use client";

import { PixelIcon } from "@/components/pixel/PixelIcon";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FriendProfile } from "@/lib/friend-schema";
import type { PublicTopic } from "@/lib/public-topic";
import { FriendAvatar } from "@/components/friends/FriendAvatar";

export function ShareSheet({ topic, friends, onClose }: { topic: PublicTopic; friends: readonly FriendProfile[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [token] = useState(() => crypto.randomUUID());
  const [url] = useState(() => `${window.location.origin}/post/${encodeURIComponent(topic.id)}`);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input")];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setFailed(false); }
    catch { setFailed(true); }
  }
  return createPortal(<dialog ref={dialogRef} className="share-sheet" aria-modal="true" aria-labelledby="share-heading" onKeyDown={trapFocus}
    onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="share-sheet-content"><div className="share-sheet-handle" aria-hidden="true" />
      <header><div><p>把见闻递给朋友</p><h2 id="share-heading">转发给好友</h2></div><button type="button" ref={closeRef} className="secondary-button" onClick={onClose} aria-label="关闭转发弹层"><PixelIcon name="close" size={16} />关闭</button></header>
      <p className="share-topic-title">{topic.title}</p>
      <ul className="share-friends" aria-label="选择转发好友">{friends.map((friend) => <li key={friend.id}><Link href={`/friends/${friend.id}?sharedTopicId=${topic.id}&shareToken=${token}`} onClick={onClose} aria-label={`转发给${friend.name}`}><FriendAvatar friend={friend} /><span>{friend.name}</span><PixelIcon name="arrowRight" size={16} /></Link></li>)}</ul>
      <button type="button" className="share-copy" onClick={() => void copy()}><PixelIcon name={copied ? "check" : "copy"} />{copied ? "链接已复制" : "复制链接"}</button>
      <label className="sr-only" htmlFor="post-share-url">把这条见闻分享给朋友</label><input id="post-share-url" readOnly value={url} onFocus={(event) => event.target.select()} />
      {failed && <p role="status">复制未完成，可选中上方链接手动复制。</p>}
    </div>
  </dialog>, document.body);
}
