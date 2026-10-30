"use client";

import { useEffect, useState } from "react";
import { PROGRESS_KEY, PROGRESS_UPDATED_EVENT, readCollectionProgress, type CollectionProgress } from "@/lib/progress";

export function useCollectionProgress(topicIds: readonly string[]) {
  const [progress, setProgress] = useState<CollectionProgress>();
  // 内容相同的题目列表无需重新订阅，也避免贴纸墙重渲染时重复 effect。
  const idsKey = JSON.stringify(topicIds);

  useEffect(() => {
    const ids: string[] = JSON.parse(idsKey);
    const refresh = () => setProgress(readCollectionProgress(ids));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === PROGRESS_KEY) refresh();
    };
    refresh();
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [idsKey]);

  return progress;
}
