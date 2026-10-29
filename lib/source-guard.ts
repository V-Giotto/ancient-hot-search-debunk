/** 保留白名单中首次出现的 ID，维持模型的引用顺序。 */
export function validateSourceIds(ids: readonly string[], allowedIds: readonly string[]): string[] {
  const allowed = new Set(allowedIds);
  return [...new Set(ids)].filter((id) => allowed.has(id));
}
