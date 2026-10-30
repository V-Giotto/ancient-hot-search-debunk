"use client";

import Link from "next/link";
import type { Sticker } from "@/lib/stickers";
import { ProgressDisplay } from "@/components/progress/CollectionProgress";
import { useCollectionProgress } from "@/components/progress/useCollectionProgress";
import { StickerBadge } from "./StickerBadge";

export function StickerWall({ stickers }: { stickers: Sticker[] }) {
  const progress = useCollectionProgress(stickers.map((sticker) => sticker.id));

  return (
    <>
      <ProgressDisplay progress={progress} />
      <ul aria-label="贴纸收藏" className="grid grid-cols-2 gap-3">
        {stickers.map((sticker) => {
          const unlocked = progress?.completedIds.includes(sticker.id) ?? false;
          const content = <>
            <StickerBadge sticker={sticker} unlocked={unlocked} />
            <h2 className="mt-3 text-sm font-bold">{sticker.name}</h2>
            <p className="mt-1 text-xs text-muted">档案 {sticker.id}</p>
            <p className={`mt-3 text-xs ${unlocked ? "text-accent" : "text-muted"}`}>{unlocked ? "已解锁 · 回看帖子 →" : "未解锁 · 提交判断后收集"}</p>
          </>;
          return <li key={sticker.id} data-sticker-id={sticker.id} data-unlocked={unlocked} className="min-w-0 rounded-2xl border border-ink/8 bg-card">
            {unlocked ? <Link href={`/post/${encodeURIComponent(sticker.id)}`} className="flex h-full flex-col rounded-2xl p-4 text-center hover:bg-gold/10">{content}</Link> : <div className="flex h-full flex-col items-center p-4 text-center">{content}</div>}
          </li>;
        })}
      </ul>
      <Link href="/trending" className="mt-5 text-sm text-accent hover:underline">← 返回热搜榜，继续查证</Link>
    </>
  );
}
