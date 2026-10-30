import { z } from "zod";
import { TopicProgressSchema, type TopicProgress } from "./schemas";

export const PROGRESS_KEY = "ahsd:progress:v1";
export const PROGRESS_UPDATED_EVENT = "ahsd:progress-updated";
const ProgressMapSchema = z.record(z.string(), z.unknown());

function readMap(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(PROGRESS_KEY);
  if (!raw) return {};
  const parsed = ProgressMapSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : {};
}

/** 兼容旧版记录的读取；单帖交互不使用此记录恢复 UI。存储异常或 SSR 时安全返回空值。 */
export function readProgress(topicId: string): TopicProgress | undefined {
  try {
    const parsed = TopicProgressSchema.safeParse(readMap()[topicId]);
    return parsed.success && parsed.data.topicId === topicId ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export type CollectionProgress = {
  completedIds: string[];
  total: number;
  storageAvailable: boolean;
};

/** 只计算当前题库中已提交并揭晓的题目；答对与否不影响收集。 */
export function readCollectionProgress(topicIds: readonly string[]): CollectionProgress {
  const ids = [...new Set(topicIds)];
  try {
    const map = readMap();
    const completedIds = ids.filter((id) => {
      const parsed = TopicProgressSchema.safeParse(map[id]);
      return parsed.success && parsed.data.topicId === id && parsed.data.revealed
        && typeof parsed.data.selectedAnswer === "boolean";
    });
    return { completedIds, total: ids.length, storageAvailable: typeof window !== "undefined" };
  } catch {
    return { completedIds: [], total: ids.length, storageAvailable: false };
  }
}

export function saveProgress(progress: TopicProgress): boolean {
  try {
    if (typeof window === "undefined") return false;
    const valid = TopicProgressSchema.parse(progress);
    // 损坏的旧 JSON 不应阻止保存本次进度。
    let previous: Record<string, unknown> = {};
    try { previous = readMap(); } catch { /* 使用空记录恢复 */ }
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...previous, [valid.topicId]: valid }));
    window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}
