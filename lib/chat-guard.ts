import type { Friend } from "./friend-schema";
import type { Source } from "./schemas";

/** 保守校验所有成对引号，避免依赖模型或启发式判断某句话是否是古诗/原话。 */
export function findUnsupportedChatQuotes(reply: string, friend: Friend, sources: Source[]): string[] {
  const originals = sources
    .filter((source) => source.status === "reviewed" && friend.sourceIds.includes(source.id))
    .flatMap(({ supports, title }) => [supports, title]);
  const unsupported = new Set<string>();
  // 分别扫描各类括号，保证引号内嵌套的《书名》也会独立校验。
  for (const pattern of [/“([^”]*)”/g, /‘([^’]*)’/g, /「([^」]*)」/g, /『([^』]*)』/g, /"([^"]*)"/g, /'([^']*)'/g, /《([^》]*)》/g]) {
    for (const match of reply.matchAll(pattern)) {
      const fragment = match[1];
      // 不归一化字形、空白或标点，也不拼接来源字段，必须在单个原文字段中连续出现。
      if (fragment && !originals.some((original) => original.includes(fragment))) unsupported.add(fragment);
    }
  }
  return [...unsupported];
}
