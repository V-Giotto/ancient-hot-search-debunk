"use client";
import { useId, useState } from "react";
import type { PublicTopic } from "@/lib/public-topic";
import type { FriendProfile } from "@/lib/friend-schema";
import { SocialIcon } from "@/components/social/SocialIcon";
import { useSocialState } from "@/components/social/useSocialState";
import { emptyInteraction, interactionCount } from "@/lib/social-storage";
import { compactCount } from "@/lib/social-display";
import { ShareSheet } from "./ShareSheet";

export function PostActions({ topic, friends = [] }: { topic: PublicTopic; friends?: readonly FriendProfile[] }) {
  const { state, toggle } = useSocialState();
  const { liked, saved } = state[topic.id] ?? emptyInteraction;
  const [sharing, setSharing] = useState(false);
  const id = useId();
  return <>
    <div className="post-actions" role="group" aria-label="帖子互动">
      <button type="button" aria-label="点赞" aria-pressed={liked} aria-describedby={`${id}-likes`} onClick={() => toggle(topic.id, "liked")}><SocialIcon name="like" /><span>{liked ? "已赞" : "点赞"}<small aria-hidden="true">{compactCount(topic.simulatedLikes)}{liked && <em>+1</em>}</small></span><span id={`${id}-likes`} className="sr-only" aria-live="polite">{interactionCount(topic.simulatedLikes, liked).toLocaleString("zh-CN")} 人点赞</span></button>
      <button type="button" aria-label="收藏" aria-pressed={saved} aria-describedby={`${id}-saves`} onClick={() => toggle(topic.id, "saved")}><SocialIcon name="bookmark" /><span>{saved ? "已收藏" : "收藏"}<small aria-hidden="true">{compactCount(topic.simulatedBookmarks)}{saved && <em>+1</em>}</small></span><span id={`${id}-saves`} className="sr-only" aria-live="polite">{interactionCount(topic.simulatedBookmarks, saved).toLocaleString("zh-CN")} 人收藏</span></button>
      <button type="button" aria-label="转发" aria-haspopup="dialog" aria-expanded={sharing} onClick={() => setSharing(true)}><SocialIcon name="repost" /><span>转发<small>{compactCount(topic.simulatedReposts)}</small></span></button>
    </div>
    {sharing && <ShareSheet topic={topic} friends={friends} onClose={() => setSharing(false)} />}
  </>;
}
