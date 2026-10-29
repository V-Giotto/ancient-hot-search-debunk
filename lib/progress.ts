import { z } from "zod";
import { TopicProgressSchema, type TopicProgress } from "./schemas";

export const PROGRESS_KEY = "ahsd:progress:v1";
const ProgressMapSchema = z.record(z.string(), z.unknown());

function readMap(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(PROGRESS_KEY);
  if (!raw) return {};
  const parsed = ProgressMapSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : {};
}

/** 浏览器禁用存储、数据损坏或 SSR 时，回退到当前页面的 React 状态。 */
export function readProgress(topicId: string): TopicProgress | undefined {
  try {
    const parsed = TopicProgressSchema.safeParse(readMap()[topicId]);
    return parsed.success && parsed.data.topicId === topicId ? parsed.data : undefined;
  } catch {
    return undefined;
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
    return true;
  } catch {
    return false;
  }
}
