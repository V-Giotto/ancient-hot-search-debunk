"use client";

import { useState } from "react";
import type { PublicTopic } from "@/lib/public-topic";
import { SocialIcon } from "@/components/social/SocialIcon";
import { compactCount } from "@/lib/social-display";

export function PostActions({ topic }: { topic: PublicTopic }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setCopyFailed(false); }
    catch { setCopyFailed(true); }
  }

  return <>
    <div className="post-actions" role="group" aria-label="帖子互动">
      <button type="button" aria-label="点赞" aria-pressed={liked} onClick={() => setLiked(!liked)}><SocialIcon name="like" /><span>{liked ? "已赞" : "点赞"}<small>{compactCount(topic.simulatedLikes + Number(liked))}</small></span></button>
      <button type="button" aria-label="收藏" aria-pressed={saved} onClick={() => setSaved(!saved)}><SocialIcon name="bookmark" /><span>{saved ? "已收藏" : "收藏"}<small>{compactCount(topic.simulatedBookmarks + Number(saved))}</small></span></button>
      <button type="button" aria-expanded={sharing} aria-controls="post-share" onClick={() => { setSharing(!sharing); setShareUrl(window.location.href); setCopied(false); setCopyFailed(false); }}><SocialIcon name="repost" /><span>转发<small>{compactCount(topic.simulatedReposts)}</small></span></button>
    </div>
    {sharing && <section id="post-share" className="post-share" aria-label="转发这条见闻">
      <label htmlFor="post-share-url">把这条见闻分享给朋友</label>
      <input id="post-share-url" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
      <button type="button" className="secondary-button" onClick={copy}>{copied ? "链接已复制" : "复制链接"}</button>
      {copyFailed && <p role="status">复制未完成，可选中上方链接手动复制。</p>}
    </section>}
  </>;
}
