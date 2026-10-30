export type TrendingTag = "爆" | "热" | "新";

/** 按榜单名次确定性派生热搜标签：前 1/4 为“爆”，末 1/4 为“新”，其余为“热”。 */
export function trendingTag(rank: number, total: number): TrendingTag {
  const quarter = Math.max(1, Math.ceil(total / 4));
  if (rank <= quarter) return "爆";
  if (rank > total - quarter) return "新";
  return "热";
}

export const trendingTagClass: Record<TrendingTag, string> = {
  爆: "bg-[#E84E48] text-white",
  热: "bg-[#F59E0B] text-white",
  新: "bg-[#2F80ED] text-white",
};
