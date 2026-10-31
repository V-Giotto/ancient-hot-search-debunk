import type { Friend } from "./friend-schema";
import type { Source } from "./schemas";
import { isLaterEra, type Era } from "./era";
import { findForbiddenKnowledgeUsage, findKnowledgeOutputViolations, getChatKnowledge } from "./friend-knowledge";

const quotePatterns = () => [/“([^”]*)”/g, /‘([^’]*)’/g, /「([^」]*)」/g, /『([^』]*)』/g, /"([^"]*)"/g, /'([^']*)'/g, /《([^》]*)》/g];

/** 保守校验所有成对引号，避免依赖模型或启发式判断某句话是否是古诗/原话。 */
export function findUnsupportedChatQuotes(reply: string, friend: Friend, sources: Source[], sharedSourceIds: readonly string[] = []): string[] {
  const originals = getChatKnowledge(friend, sources, sharedSourceIds)
    .filter((record) => record.allowedUsage.includes("exact_quote"))
    .map(({ exactQuote }) => exactQuote);
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

function hasMixedPersonaSelfReferences(reply: string, friend: Friend): boolean {
  // 我／吾沿用原保守检查。新自称只匹配明确主语，避免把月光、余下、明亮当自称。
  let narration = reply;
  for (const pattern of quotePatterns()) narration = narration.replace(pattern, " ");
  const references = new Set<string>();
  for (const self of ["我", "吾", "某", "朕", "余", "丘", "光", "亮", "本汗", "守仁", "逸少", "羲之", "易安", "东坡", "老夫", "李太白"]) {
    const subject = new RegExp(`(?:^|[，。！？；：,.!?;:\\n）)]|此事|听说|听闻|据说|交与|与|给|问|对|向|陪|听)\\s*${escapeRegExp(self)}(?=$|[，。！？；：、\\s]|不|也|亦|愿|想|听|记|知|敢|曾|未|能|会|可|来|去|与|是|有|无|还|只|便|先|再|在|替|今|这|那|的|一|倒|看|说|问|听|送|觉|正|喜|此|方|亲|同|赞|陪|今日|今日)`, "u");
    if (subject.test(narration)) references.add(self);
  }
  // 甫是原有兼容自称，不影响我／吾规范化；其余人物的不同自称不混用。
  return references.size > 1 || [...references].some((self) => !friend.persona.selfReference.includes(self) && !(friend.id === "dufu" && self === "吾"));
}

/** 只替换可确认的少数方主语自称；平票、引文、书名或复合词保持原文以触发重试。 */
export function normalizeChatSelfReferences(reply: string, friend: Friend): string {
  const count = (self: string) => [...reply.matchAll(new RegExp(self, "gu"))].length;
  const wo = count("我");
  const wu = count("吾");
  if (!wo || !wu || wo === wu) return reply;
  const majority = wo > wu ? "我" : "吾";
  const minority = wo > wu ? "吾" : "我";
  if (!friend.persona.selfReference.includes(majority)) return reply;

  const protectedRanges: [number, number][] = [];
  let unquoted = reply;
  for (const pattern of quotePatterns()) {
    for (const match of reply.matchAll(pattern)) protectedRanges.push([match.index, match.index + match[0].length]);
    unquoted = unquoted.replace(pattern, " ");
  }
  if (/[“”‘’「」『』《》"']/u.test(unquoted)) return reply;
  const positions = [...reply.matchAll(new RegExp(minority, "gu"))].map((match) => match.index);
  for (const index of positions) {
    if (protectedRanges.some(([start, end]) => index >= start && index < end)) return reply;
    // 只确认分句开头的主语，避免把无我、自我、忘我、你我等复合词改成自称。
    // 句中宾语、定语和无法确定的结构交给重试，不尝试猜词义。
    if (!/(?:^|[，。！？；：,.!?;:\n])\s*$/u.test(reply.slice(0, index))) return reply;
    if (!/^(?:不|也|亦|愿|想|看|听|记|知|敢|曾|未|能|会|可|来|去|与|和|是|有|无|还|仍|只|觉得|认为|便|就|先|再|倒|并|虽|若|恐|且|却|正|总|已|很|更|见|说|问|写|读|须|当)/u.test(reply.slice(index + 1))) return reply;
  }
  return reply.replaceAll(minority, majority);
}

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
  const mixedSelfReferences = (reply.includes("我") && reply.includes("吾")) || hasMixedPersonaSelfReferences(reply, friend);
  const knowledgeViolations = [...findKnowledgeOutputViolations(reply, getChatKnowledge(friend, sources, sharedSourceIds)), ...findForbiddenKnowledgeUsage(reply, friend)];
  return { unsupportedQuotes: findUnsupportedChatQuotes(reply, friend, sources, sharedSourceIds), personaFragments: [...personaFragments], missingEraMarker, mixedSelfReferences,
    ...(knowledgeViolations.length ? { knowledgeViolations } : {}),
  };
}

export function getChatSafeReply(friend: Friend, topicEra?: Era): string {
  if (topicEra && isLaterEra(topicEra, friend.era)) return `${friend.persona.selfReference[0]}身后之事，只是耳闻，不敢多说。`;
  return `此事${friend.persona.selfReference[0]}记不真切了，换个话头可好？`;
}
