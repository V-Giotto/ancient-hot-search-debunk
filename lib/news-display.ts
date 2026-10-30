/** 固定的页面发布时间，和报道中的历史事件时间无关。 */
export function newsTimestamp(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}
