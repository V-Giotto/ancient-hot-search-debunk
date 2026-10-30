"use client";

import { useState } from "react";
import type { Comment } from "@/lib/schemas";
import { commentRelativeTime } from "@/lib/social-display";
import { AuthorRow } from "@/components/social/AuthorRow";
import { SocialStats } from "@/components/social/SocialStats";

export function Comments({ comments }: { comments: Comment[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="panel" aria-labelledby="comments-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="comments-heading" className="text-lg font-bold">评论区，开锅了</h2>
      </div>
      <ul id="post-comments" className="mt-3 divide-y divide-ink/7">
        {(expanded ? comments : comments.slice(0, 4)).map((comment, index) => (
          <li key={comment.id} className="comment-row py-5">
            <AuthorRow name={comment.author} avatarUrl={comment.avatar} relativeTime={commentRelativeTime(index)} />
            <p className="mt-3 text-sm leading-7">{comment.text}</p>
            <div className="mt-3"><SocialStats label={`${comment.author}的评论统计`} counts={{ replies: comment.simulatedReplies ?? 0, reposts: comment.simulatedReposts ?? 0, likes: comment.simulatedLikes, views: comment.simulatedViews ?? 0 }} /></div>
          </li>
        ))}
      </ul>
      <button type="button" aria-expanded={expanded} aria-controls="post-comments" onClick={() => setExpanded(!expanded)} className="secondary-button w-full">
        {expanded ? "收起评论" : `展开更多评论（还有 ${comments.length - 4} 条）`}
      </button>
    </section>
  );
}
