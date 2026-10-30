import { z } from "zod";

export const COMMENT_LIMIT = 280;
export const COMMENT_CAPACITY = 100;
export const commentStorageKey = (contentId: string) => `ahsd:comments:v1:${contentId}`;
const LocalCommentSchema = z.strictObject({
  id: z.string().startsWith("local-").max(100),
  parentId: z.string().min(1).max(150).nullable(),
  text: z.string().trim().min(1).max(COMMENT_LIMIT),
  createdAt: z.iso.datetime(),
});
export type LocalComment = z.infer<typeof LocalCommentSchema>;

export function validateComment(text: string): string | undefined {
  if (!text.trim()) return "写点内容再保存吧。";
  if (text.trim().length > COMMENT_LIMIT) return `最多 ${COMMENT_LIMIT} 字，请缩短后再保存。`;
}

/** 顺序校验父节点；损坏、未知版本、跨帖悬空回复不会进入 UI。 */
export function parseLocalComments(raw: string | null, presetIds: readonly string[]): LocalComment[] {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value?.version !== 1 || !Array.isArray(value.comments)) return [];
    const known = new Set(presetIds);
    const comments: LocalComment[] = [];
    for (const item of value.comments.slice(0, COMMENT_CAPACITY)) {
      const parsed = LocalCommentSchema.safeParse(item);
      if (!parsed.success) continue;
      const comment = parsed.data;
      if (known.has(comment.id) || (comment.parentId !== null && !known.has(comment.parentId))) continue;
      known.add(comment.id);
      comments.push(comment);
    }
    return comments;
  } catch { return []; }
}

/** 写入前重新读取，避免多个页面顺序操作覆盖彼此；失败不声称保存成功。 */
export function updateLocalComments(contentId: string, presetIds: readonly string[], update: (comments: LocalComment[]) => LocalComment[]): LocalComment[] {
  const key = commentStorageKey(contentId);
  const current = parseLocalComments(window.localStorage.getItem(key), presetIds);
  const next = update(current);
  window.localStorage.setItem(key, JSON.stringify({ version: 1, comments: next }));
  window.dispatchEvent(new CustomEvent("ahsd:comments-updated", { detail: key }));
  return next;
}

export function removeLocalComment(comments: LocalComment[], id: string): LocalComment[] {
  const removed = new Set([id]);
  return comments.filter((comment) => {
    if (comment.parentId && removed.has(comment.parentId)) removed.add(comment.id);
    return !removed.has(comment.id);
  });
}
