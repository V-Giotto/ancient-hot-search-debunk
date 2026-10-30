/** 固定的展示元数据；不依赖当前时间，也不表示实时社区数据。 */
const postTimes = ["3小时", "5小时", "2小时", "6小时", "1天", "8小时", "1天", "9小时", "1小时", "4小时", "7小时", "2天"];

export function compactCount(count: number): string {
  return count.toLocaleString("zh-CN", { notation: "compact", maximumFractionDigits: 1 });
}

export function postRelativeTime(rank: number): string {
  return postTimes[(rank - 1) % postTimes.length] ?? "3小时";
}

export function commentRelativeTime(index: number): string {
  return ["5分钟", "12分钟", "18分钟", "25分钟", "32分钟", "41分钟", "51分钟", "1小时"][index % 8];
}
