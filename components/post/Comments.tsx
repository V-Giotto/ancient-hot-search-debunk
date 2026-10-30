"use client";

import { PixelIcon } from "@/components/pixel/PixelIcon";

import { useState } from "react";
import type { Comment, CommentReply } from "@/lib/schemas";
import { commentRelativeTime } from "@/lib/social-display";
import { AuthorRow } from "@/components/social/AuthorRow";
import { SocialStats } from "@/components/social/SocialStats";

function ReplyThread({ replies, parentId, parentAuthor, author }: { replies: CommentReply[]; parentId: string; parentAuthor: string; author: string }) {
  const children = replies.filter((reply) => reply.replyTo === parentId);
  if (!children.length) return null;
  return <ol className="reply-thread" aria-label={`回复${parentAuthor}的线程`}>
    {children.map((reply) => <li key={reply.id} data-reply-id={reply.id} data-reply-to={reply.replyTo}>
      <AuthorRow name={reply.author} avatarUrl={reply.avatar} relativeTime="刚刚" isAuthor={reply.author === author} />
      <p className="reply-text"><span className="reply-target">回复 {parentAuthor}：</span>{reply.text}</p>
      <ReplyThread replies={replies} parentId={reply.id} parentAuthor={reply.author} author={author} />
    </li>)}
  </ol>;
}

export function Comments({ comments, author = "", title, module = "discover" }: { comments: Comment[]; author?: string; title?: string; module?: "trending" | "discover" }) {
  const [expanded, setExpanded] = useState(false);
  const news = module === "trending";
  return (
    <section className={`panel comments-panel${news ? " news-comments" : ""}`} aria-labelledby="comments-heading">
      <p className="comments-context">{news ? "热搜 · 报道讨论" : "发现 · 帖子讨论"}<span>{title}</span></p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="comments-heading" tabIndex={-1} className="text-lg font-bold">{news ? "读者评论" : "评论区"}</h2>
        <span className="text-xs text-muted">查看讨论</span>
      </div>
      <ul id="post-comments" className="mt-3 divide-y divide-ink/7">
        {(expanded ? comments : comments.slice(0, 4)).map((comment, index) => (
          <li key={comment.id} className="comment-row py-5">
            <AuthorRow name={comment.author} avatarUrl={comment.avatar} relativeTime={commentRelativeTime(index)} isAuthor={comment.author === author} />
            <p className="mt-3 text-sm leading-7">{comment.text}</p>
            <div className="mt-3"><SocialStats label={`${comment.author}的评论统计`} counts={{ replies: comment.simulatedReplies ?? 0, reposts: comment.simulatedReposts ?? 0, likes: comment.simulatedLikes, views: comment.simulatedViews ?? 0 }} /></div>
            <ReplyThread replies={comment.replies ?? []} parentId={comment.id} parentAuthor={comment.author} author={author} />
          </li>
        ))}
      </ul>
      {comments.length > 4 && <button type="button" aria-expanded={expanded} aria-controls="post-comments" onClick={() => setExpanded(!expanded)} className="secondary-button w-full">
        <PixelIcon name={expanded ? "collapse" : "expand"} size={16} />{expanded ? "收起评论" : `展开更多评论（还有 ${comments.length - 4} 条）`}
      </button>}
    </section>
  );
}
