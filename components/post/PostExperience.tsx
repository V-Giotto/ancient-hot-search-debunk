"use client";

import { PixelIcon } from "@/components/pixel/PixelIcon";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import type { FriendProfile } from "@/lib/friend-schema";
import type { PublicTopic } from "@/lib/public-topic";
import { Comments } from "./Comments";
import { VerdictTask } from "./VerdictTask";
import { PostFormat } from "./formats";
import type { RelatedEntry } from "@/lib/feed";
import { SameTopic } from "./SameTopic";
import { Participation } from "./Participation";
import type { VerdictResult } from "@/lib/verdict";

type Props = { topic: PublicTopic; topicIds: readonly string[]; friends?: readonly FriendProfile[]; relatedEntries?: readonly RelatedEntry[] };

function PostSession({ topic, topicIds, friends, relatedEntries = [], replay, collectedTopics }: Props & { replay: () => void; collectedTopics: Set<string> }) {
  const [verdict, setVerdict] = useState<VerdictResult>();
  return <Participation topic={topic} post={<PostFormat topic={topic} friends={friends} />}>
    <Comments comments={topic.comments} author={topic.author.name} title={topic.title} module={topic.module} contentId={topic.id} topicId={topic.topicId} verdict={verdict} />
    <VerdictTask topic={topic} topicIds={topicIds} onReplay={replay} onResult={setVerdict} collectedTopics={collectedTopics} />
    <SameTopic entries={relatedEntries} />
    <Link href={topic.module === "trending" ? "/trending" : "/discover"} className="inline-block py-2 text-sm text-accent hover:underline"><PixelIcon name="back" size={16} /> 返回{topic.module === "trending" ? "热搜榜，继续阅读" : "发现，继续围观"}</Link>
  </Participation>;
}

export function PostExperience({ topic, topicIds, friends = [], relatedEntries = [] }: Props) {
  const [attempt, setAttempt] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusTaskRef = useRef(false);
  // 存储不可用时，同一次页面体验内重玩也不重复提示获得贴纸。
  const collectedTopics = useRef(new Set<string>());

  useLayoutEffect(() => {
    // Next 的路由 Activity 再次显示时会重新运行 effect，历史返回也从新题面开始。
    setAttempt((value) => value + 1);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setAttempt((value) => value + 1);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [topic.id]);

  useLayoutEffect(() => {
    if (!focusTaskRef.current) return;
    focusTaskRef.current = false;
    const heading = contentRef.current?.querySelector<HTMLHeadingElement>("#task-heading");
    heading?.focus({ preventScroll: true });
    heading?.closest(".task-panel")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }, [attempt]);

  function replay() {
    focusTaskRef.current = true;
    setAttempt((value) => value + 1);
  }

  return (
    <div key={`${topic.id}:${attempt}`} ref={contentRef} className={`post-experience ${topic.module === "trending" ? "news-experience" : "social-experience"} space-y-6`}>
      <PostSession topic={topic} topicIds={topicIds} friends={friends} relatedEntries={relatedEntries} replay={replay} collectedTopics={collectedTopics.current} />
    </div>
  );
}
