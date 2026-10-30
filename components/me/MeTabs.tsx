"use client";

import { PixelIcon } from "@/components/pixel/PixelIcon";

import { useId, useRef, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StickerWall } from "@/components/stickers/StickerWall";
import { MyFavorites } from "./MyFavorites";
import type { SharedTopic } from "@/lib/chat-storage";
import type { Sticker } from "@/lib/stickers";

const tabs = [{ id: "stickers", label: "贴纸" }, { id: "favorites", label: "收藏" }] as const;

export function MeTabs({ stickers, firstTopicId, topics }: { stickers: Sticker[]; firstTopicId?: string; topics: readonly SharedTopic[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selected = searchParams.get("tab") === "favorites" ? "favorites" : "stickers";
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  function select(index: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabs[index].id);
    router.replace(`/me?${params.toString()}`, { scroll: false });
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % tabs.length; break;
      case "ArrowLeft": next = (index - 1 + tabs.length) % tabs.length; break;
      case "Home": next = 0; break;
      case "End": next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus({ preventScroll: true });
  }

  return <>
    <div role="tablist" aria-label="我的内容" className="me-tabs">
      {tabs.map((tab, index) => <button key={tab.id} ref={(node) => { tabRefs.current[index] = node; }}
        type="button" role="tab" id={`${id}-tab-${tab.id}`} aria-controls={`${id}-panel-${tab.id}`}
        aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1}
        onClick={() => select(index)} onKeyDown={(event) => handleKey(event, index)}><PixelIcon name={tab.id === "stickers" ? "stickers" : "bookmark"} size={16} />{tab.label}</button>)}
    </div>
    <section role="tabpanel" id={`${id}-panel-stickers`} aria-labelledby={`${id}-tab-stickers`} hidden={selected !== "stickers"} tabIndex={0} className="me-panel">
      <h2>查证贴纸墙</h2>
      <p className="sticker-intro">每查证一条，留下一枚主题贴纸。答对答错都能收集，点击已收藏贴纸可重新挑战，进度不重复累计。</p>
      <StickerWall stickers={stickers} firstTopicId={firstTopicId} />
    </section>
    <section role="tabpanel" id={`${id}-panel-favorites`} aria-labelledby={`${id}-tab-favorites`} hidden={selected !== "favorites"} tabIndex={0} className="me-panel">
      <MyFavorites topics={topics} />
    </section>
  </>;
}
