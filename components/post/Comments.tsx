"use client";

import { useState } from "react";
import type { Comment } from "@/lib/schemas";

const roles: Record<Comment["role"], string> = {
  spectator: "吃瓜群众", troll: "气氛营销号", history_nerd: "历史课代表", in_world: "时代网友",
};

export function Comments({ comments }: { comments: Comment[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="panel" aria-labelledby="comments-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="comments-heading" className="text-lg font-bold">评论区，开锅了</h2>
      </div>
      <ul id="post-comments" className="mt-3 divide-y divide-ink/7">
        {(expanded ? comments : comments.slice(0, 4)).map((comment) => (
          <li key={comment.id} className="flex gap-3 py-5">
            {comment.avatar && <img src={comment.avatar} alt={`${comment.author}头像`} width={38} height={38} className="size-10 shrink-0 rounded-xl" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{comment.author}</span>
                <span className="rounded bg-background px-2 py-0.5 text-[11px] text-muted">{roles[comment.role]}</span>
              </div>
              <p className="mt-2 text-sm leading-7">{comment.text}</p>
              <p className="mt-2 text-xs text-muted">赞 {comment.simulatedLikes.toLocaleString("zh-CN")}</p>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" aria-expanded={expanded} aria-controls="post-comments" onClick={() => setExpanded(!expanded)} className="secondary-button w-full">
        {expanded ? "收起评论" : `展开更多评论（还有 ${comments.length - 4} 条）`}
      </button>
    </section>
  );
}
