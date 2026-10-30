import type { Friend } from "./friend-schema";
import type { Source } from "./schemas";
import { isLaterEra, type Era } from "./era";

const quotePatterns = () => [/“([^”]*)”/g, /‘([^’]*)’/g, /「([^」]*)」/g, /『([^』]*)』/g, /"([^"]*)"/g, /'([^']*)'/g, /《([^》]*)》/g];

/** 保守校验所有成对引号，避免依赖模型或启发式判断某句话是否是古诗/原话。 */
export function findUnsupportedChatQuotes(reply: string, friend: Friend, sources: Source[], sharedSourceIds: readonly string[] = []): string[] {
  const originals = sources
    .filter((source) => source.status === "reviewed" && (friend.sourceIds.includes(source.id) || sharedSourceIds.includes(source.id)))
    .flatMap(({ supports, title }) => [supports, title]);
  const unsupported = new Set<string>();
  // 分别扫描各类括号，保证引号内嵌套的《书名》也会独立校验。
  for (const pattern of quotePatterns()) {
    for (const match of reply.matchAll(pattern)) {
      const fragment = match[1];
      // 不归一化字形、空白或标点，也不拼接来源字段，必须在单个原文字段中连续出现。
      if (fragment && !originals.some((original) => original.includes(fragment))) unsupported.add(fragment);
    }
  }
  return [...unsupported];
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function findChatOutputViolations(reply: string, friend: Friend, sources: Source[], sharedSourceIds: readonly string[] = [], topicEra?: Era) {
  const personaFragments = new Set<string>();
  const meta = /(?:根据|依据|按照)?资料(?:里|中|显示|表明|记载)?|来源|设定|提示词|人工智能|模型|角色扮演|(?:作为\s*)?\bAI\b/giu;
  for (const match of reply.matchAll(meta)) personaFragments.add(match[0]);

  // 书名、原文中的姓名不是自我旁白；它们另由逐字引文校验负责，不能借引号绕过。
  let narration = reply;
  for (const pattern of quotePatterns()) narration = narration.replace(pattern, " ");
  const name = escapeRegExp(friend.name);
  const references = friend.persona.selfReference.map(escapeRegExp).join("|");
  // 正常第一人称介绍可报姓名；其余使用自己全名的旁白须改成自称。
  narration = narration.replace(new RegExp(`(?:${references})(?:就是|便是|是|名叫|叫|名为)\\s*${name}`, "gu"), " ");
  const selfNarration = new RegExp(`(?:(?:${references})\\s*)?[（(]\\s*${name}\\s*[）)]|${name}(?:\\s*(?:说(?:过|道)?|曰|认为|觉得|表示|写(?:过|道)?))?`, "gu");
  for (const match of narration.matchAll(selfNarration)) personaFragments.add(match[0]);

  const missingEraMarker = Boolean(topicEra && isLaterEra(topicEra, friend.era) && !/听说|听闻|耳闻|据说|后世|身后/u.test(reply));
  return { unsupportedQuotes: findUnsupportedChatQuotes(reply, friend, sources, sharedSourceIds), personaFragments: [...personaFragments], missingEraMarker };
}

export function getChatSafeReply(friend: Friend, topicEra?: Era): string {
  if (topicEra && isLaterEra(topicEra, friend.era)) return `${friend.persona.selfReference[0]}身后之事，只是耳闻，不敢多说。`;
  return `此事${friend.persona.selfReference[0]}记不真切了，换个话头可好？`;
}
