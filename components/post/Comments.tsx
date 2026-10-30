"use client";

import { PixelIcon } from "@/components/pixel/PixelIcon";

import { useMemo, useState } from "react";
import type { Comment, CommentReply } from "@/lib/schemas";
import { commentRelativeTime } from "@/lib/social-display";
import { AuthorRow } from "@/components/social/AuthorRow";
import { SocialStats } from "@/components/social/SocialStats";
import { debates } from "@/lib/participation";
import type { VerdictResult } from "@/lib/verdict";
import { WordingText } from "./Participation";
import { LocalDiscussion, LocalReplies, ReplyButton } from "./LocalDiscussion";

function ReplyThread({ replies, parentId, parentAuthor, author }: { replies: CommentReply[]; parentId: string; parentAuthor: string; author: string }) {
  const children = replies.filter((reply) => reply.replyTo === parentId);
  if (!children.length) return null;
  return <ol className="reply-thread" aria-label={`回复${parentAuthor}的线程`}>
    {children.map((reply) => <li key={reply.id} data-reply-id={reply.id} data-reply-to={reply.replyTo}>
      <AuthorRow name={reply.author} avatarUrl={reply.avatar} relativeTime="刚刚" isAuthor={reply.author === author} />
      <p className="reply-text"><span className="reply-target">回复 {parentAuthor}：</span><WordingText text={reply.text} /></p>
      <ReplyButton id={reply.id} author={reply.author} />
      <LocalReplies parentId={reply.id} />
      <ReplyThread replies={replies} parentId={reply.id} parentAuthor={reply.author} author={author} />
    </li>)}
  </ol>;
}

export function Comments({ comments, author = "", title, module = "discover", contentId = "discussion", topicId, verdict }: { comments: Comment[]; author?: string; title?: string; module?: "trending" | "discover"; contentId?: string; topicId?: string; verdict?: VerdictResult }) {
  const [expanded, setExpanded] = useState(false);
  const news = module === "trending";
  const debate = topicId ? debates[topicId] : undefined;
  const debateId = `debate-${contentId}`;
  const presetIds = useMemo(() => [...comments.flatMap((comment) => [comment.id, ...(comment.replies ?? []).map(({ id }) => id)]), `debate-${contentId}`, `debate-${contentId}-challenge`, `debate-${contentId}-response`], [comments, contentId]);
  return (
    <section className={`panel comments-panel${news ? " news-comments" : ""}`} aria-labelledby="comments-heading">
      <p className="comments-context">{news ? "热搜 · 报道讨论" : "发现 · 帖子讨论"}<span>{title}</span></p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="comments-heading" tabIndex={-1} className="text-lg font-bold">{news ? "读者评论" : "评论区"}</h2>
        <span className="text-xs text-muted">查看讨论</span>
      </div>
      <LocalDiscussion contentId={contentId} presetIds={presetIds}>
      {debate && <section className="debate-thread" aria-label="争议回复串">
        <p className="eyebrow">这层楼还没谈拢</p>
        <AuthorRow name={debate.author} relativeTime="刚刚" />
        <p className="reply-text"><WordingText text={debate.text} /></p>
        <ReplyButton id={debateId} author={debate.author} /><LocalReplies parentId={debateId} />
        <ol className="reply-thread"><li>
          <AuthorRow name="追问一句" relativeTime="刚刚" />
          <p className="reply-text"><span className="reply-target">回复 {debate.author}：</span><WordingText text={debate.challenge} /></p>
          <ReplyButton id={`${debateId}-challenge`} author="追问一句" /><LocalReplies parentId={`${debateId}-challenge`} />
          <ol className="reply-thread"><li>
            <AuthorRow name={debate.author} relativeTime="刚刚" />
            <p className="reply-text"><WordingText text={debate.response} /></p>
            <ReplyButton id={`${debateId}-response`} author={debate.author} /><LocalReplies parentId={`${debateId}-response`} />
          </li></ol>
        </li></ol>
        {verdict && <div className="debate-correction" role="status">
          <p><strong>{debate.author} · 看过证据后</strong></p>
          <p>我收回刚才凭直觉下的断言。对照材料，应当这样说：</p>
          <p>{verdict.reveal.correctedClaim}</p>
          <ul aria-label="纠正依据">{verdict.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
        </div>}
      </section>}
      <ul id="post-comments" className="mt-3 divide-y divide-ink/7">
        {(expanded ? comments : comments.slice(0, 4)).map((comment, index) => (
          <li key={comment.id} className="comment-row py-5">
            <AuthorRow name={comment.author} avatarUrl={comment.avatar} relativeTime={commentRelativeTime(index)} isAuthor={comment.author === author} />
            <p className="mt-3 text-sm leading-7"><WordingText text={comment.text} /></p>
            <div className="mt-3"><SocialStats label={`${comment.author}的评论统计`} counts={{ replies: comment.simulatedReplies ?? 0, reposts: comment.simulatedReposts ?? 0, likes: comment.simulatedLikes, views: comment.simulatedViews ?? 0 }} /></div>
            <ReplyThread replies={comment.replies ?? []} parentId={comment.id} parentAuthor={comment.author} author={author} />
            <ReplyButton id={comment.id} author={comment.author} /><LocalReplies parentId={comment.id} />
          </li>
        ))}
      </ul>
      {comments.length > 4 && <button type="button" aria-expanded={expanded} aria-controls="post-comments" onClick={() => setExpanded(!expanded)} className="secondary-button w-full">
        <PixelIcon name={expanded ? "collapse" : "expand"} size={16} />{expanded ? "收起评论" : `展开更多评论（还有 ${comments.length - 4} 条）`}
      </button>}
      </LocalDiscussion>
    </section>
  );
}
