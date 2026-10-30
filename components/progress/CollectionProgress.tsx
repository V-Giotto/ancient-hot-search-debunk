"use client";

import Link from "next/link";
import type { CollectionProgress as Progress } from "@/lib/progress";
import { useCollectionProgress } from "./useCollectionProgress";

export function ProgressDisplay({ progress, showLink = false }: { progress?: Progress; showLink?: boolean }) {
  return (
    <section className="mb-6 rounded-2xl border border-gold/40 bg-card p-4" aria-label="本机查证进度">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted">本机查证档案</p>
          <p role="status" className="mt-1 text-lg font-bold">{progress ? `已查证 ${progress.completedIds.length}/${progress.total}` : "正在读取本机进度…"}</p>
        </div>
        {showLink && <Link href="/stickers" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent/5">贴纸墙 →</Link>}
      </div>
      {progress && <progress className="collection-meter mt-3 block h-1.5 w-full" aria-label="已查证题目" value={progress.completedIds.length} max={progress.total || 1} />}
      <p className="mt-3 text-xs leading-5 text-muted">{progress?.storageAvailable === false ? "本机存储不可用，暂时无法读取收集；仍可继续答题。" : "仅保存在本机，重温不重复累计；清除浏览器存储后归零。"}</p>
    </section>
  );
}

export function CollectionProgress({ topicIds }: { topicIds: readonly string[] }) {
  return <ProgressDisplay progress={useCollectionProgress(topicIds)} showLink />;
}
