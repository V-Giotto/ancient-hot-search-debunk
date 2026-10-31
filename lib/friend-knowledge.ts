import { z } from "zod";
import type { Source } from "./schemas";

const text = z.string().trim().min(1);
const year = z.number().int().min(-4000).max(3000).refine((value) => value !== 0, "历史纪年无零年；公元前用负数");
export const LifespanSchema = z.strictObject({ birthYear: year, deathYear: year, note: text })
  .refine((value) => value.birthYear <= value.deathYear, "生卒顺序错误");
export const KnowledgeDateSchema = z.strictObject({ earliest: year, latest: year, note: text })
  .refine((value) => value.earliest <= value.latest, "日期区间顺序错误");
export const KnowledgeReviewSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending"), reviewer: text, reviewedAt: z.null() }),
  z.strictObject({ status: z.literal("reviewed"), reviewer: text, reviewedAt: z.iso.datetime({ offset: true }) }),
]);
export const FriendKnowledgeSchema = z.strictObject({
  sourceId: text,
  factId: text,
  tier: z.enum(["verified_fact", "sourced_anecdote", "persona_expression"]),
  evidenceType: z.enum(["primary_text", "official_history", "museum", "later_note", "persona", "legacy_reviewed_source"]),
  certainty: z.enum(["confirmed", "reported", "disputed", "creative"]),
  allowedUsage: z.array(z.enum(["paraphrase", "first_person", "exact_quote", "attributed", "persona_expression"])).min(1)
    .refine((values) => new Set(values).size === values.length, "使用权限不能重复"),
  content: text.max(12000),
  // 不 trim、不转换繁简、不修标点。空串表示没有任何逐字引用权限。
  exactQuote: z.string().max(12000),
  subjects: z.array(text).min(1),
  materialDate: KnowledgeDateSchema.nullable(),
  eventDate: KnowledgeDateSchema.nullable(),
  reviewStatus: KnowledgeReviewSchema,
  source: z.strictObject({
    title: text,
    citationName: text.optional(),
    url: z.url(),
    accessedAt: z.iso.datetime({ offset: true }),
    accessMethod: text,
    accessStatus: z.enum(["opened", "unavailable", "snippet_only", "legacy_review"]),
    originalText: z.string().max(16000),
  }),
}).superRefine((record, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (record.allowedUsage.includes("exact_quote") && !record.exactQuote) issue("逐字引用须提供 exactQuote");
  if (record.allowedUsage.includes("first_person") && !record.allowedUsage.includes("paraphrase")) issue("第一人称叙述须同时允许转述");
  if (record.exactQuote && !record.source.originalText.includes(record.exactQuote)) issue("exactQuote 必须连续逐字出自核对原文");
  if (record.tier === "persona_expression") {
    if (record.certainty !== "creative" || record.evidenceType !== "persona" || record.exactQuote || record.allowedUsage.some((usage) => usage !== "persona_expression")) issue("人设表达不能获得事实或原话权限");
  } else {
    if (record.evidenceType === "persona" || record.certainty === "creative" || record.allowedUsage.includes("persona_expression")) issue("事实不能借用人设权限");
    if (record.tier === "verified_fact" && record.certainty !== "confirmed") issue("确定事实须 confirmed");
    if (record.tier === "sourced_anecdote" && (!record.allowedUsage.includes("attributed") || record.allowedUsage.includes("first_person"))) issue("文献记述须注明出处且不能亲历");
    if (record.reviewStatus.status === "reviewed" && !["opened", "legacy_review"].includes(record.source.accessStatus)) issue("未打开正文不能审核为可用事实");
  }
});

export type FriendKnowledge = z.infer<typeof FriendKnowledgeSchema>;
type KnowledgeFriend = { lifespan: z.infer<typeof LifespanSchema>; knowledge: FriendKnowledge[]; sourceIds: string[] };

export function getKnowledgeLifecycle(friend: Pick<KnowledgeFriend, "lifespan">, record: Pick<FriendKnowledge, "materialDate" | "eventDate">) {
  const { birthYear, deathYear } = friend.lifespan;
  // 区间跨越卒年也保守按身后材料；不知道日期不能授予亲历权限。
  const posthumous = [record.materialDate, record.eventDate].some((date) => date !== null && date.latest > deathYear);
  const contemporary = [record.materialDate, record.eventDate].every((date) => date !== null && date.earliest >= birthYear && date.latest <= deathYear);
  return { posthumous, contemporary };
}

/** 旧题来源只继承已有审核范围，不从 supports/title 自动提取引文或授予亲历。 */
function legacyKnowledge(source: Source): FriendKnowledge | undefined {
  if (source.status !== "reviewed" || !source.verifiedBy || !source.verifiedAt) return;
  const result = FriendKnowledgeSchema.safeParse({
    sourceId: source.id, factId: `legacy:${source.id}`, tier: "sourced_anecdote",
    evidenceType: "legacy_reviewed_source", certainty: "reported", allowedUsage: ["paraphrase", "attributed"],
    content: source.supports, exactQuote: "", subjects: [source.title], materialDate: null, eventDate: null,
    reviewStatus: { status: "reviewed", reviewer: source.verifiedBy, reviewedAt: source.verifiedAt },
    source: { title: source.title, url: source.url, accessedAt: source.verifiedAt, accessMethod: "继承旧题已审 supports 范围；本版未重新核对，不授权逐字引文", accessStatus: "legacy_review", originalText: "" },
  });
  return result.success ? result.data : undefined;
}

export function getChatKnowledge(friend: KnowledgeFriend, sources: Source[] = [], sharedSourceIds: readonly string[] = []) {
  const records: FriendKnowledge[] = [];
  // 即使调用方绕过加载器，也重新解析并在序列化之前过滤，pending 连标题都不发送。
  for (const value of friend.knowledge) {
    const parsed = FriendKnowledgeSchema.safeParse(value);
    if (parsed.success && parsed.data.reviewStatus.status === "reviewed" && parsed.data.tier !== "persona_expression") records.push(parsed.data);
  }
  for (const source of sources) {
    if (!friend.sourceIds.includes(source.id) && !sharedSourceIds.includes(source.id)) continue;
    // 新记录的审核是逐 factId 的；同 sourceId 的旧 supports 不能绕过 pending 门控。
    if (friend.knowledge.some((record) => record.sourceId === source.id)) continue;
    const record = legacyKnowledge(source);
    if (record) records.push(record);
  }
  return records.map((record) => {
    const lifecycle = getKnowledgeLifecycle(friend, record);
    const firstPersonAllowed = record.tier === "verified_fact" && record.allowedUsage.includes("first_person") && lifecycle.contemporary;
    return {
      ...record, ...lifecycle, firstPersonAllowed,
      content: record.allowedUsage.includes("paraphrase") ? record.content : "",
      exactQuote: record.allowedUsage.includes("exact_quote") ? record.exactQuote : "",
      allowedUsage: record.allowedUsage.filter((usage) => usage !== "first_person" || firstPersonAllowed),
      voiceConstraint: lifecycle.posthumous ? "posthumous：必须以听闻后世、身后之事口吻；绝不能第一人称亲历，也不能声称读过身后编定的书。"
        : record.tier === "sourced_anecdote" ? `必须以据${record.source.citationName ?? record.source.title}记载的口吻，表明只是文献记述，不当确定亲历。`
          : firstPersonAllowed ? "只可在本条范围内自然叙述，不扩写现场。" : "日期不明或不在本人生前，只能转述，不得亲历。",
      attributionConstraint: record.tier === "sourced_anecdote" || record.allowedUsage.includes("attributed") ? `据${record.source.citationName ?? record.source.title}记载；身后材料还须说明后世听闻。` : "保留本条 certainty 与限制。",
    };
  });
}

export type ChatKnowledge = ReturnType<typeof getChatKnowledge>[number];

/** 针对被谈及的材料执行口吻校验；不把情绪闲聊强行变成文献转述。 */
export function findKnowledgeOutputViolations(reply: string, records: ChatKnowledge[]): string[] {
  const violations = new Set<string>();
  const firstPersonExperience = /(?:^|[，。！？；：,.!?;:\n）)])\s*(?:我|吾|朕|某|余|丘|甫|光|亮|本汗|守仁|逸少|羲之|易安|东坡|老夫)(?:是|早就)?(?:当年|当时|那年|曾经|曾|亲眼|亲自|亲历|记得|还记得|读过|看过|见过|写过|编过|编定|参与|主持|下令|命人|去过|(?:就|也)?在场|在.{0,12}(?:见|读|看|写|游|修|治|建))/u;
  const narration = reply.replace(/[“「『"].*?[”」』"]/gu, "");
  const mentions = (record: ChatKnowledge) => record.subjects.some((subject) => reply.includes(subject)) || Boolean(record.exactQuote && reply.includes(record.exactQuote));
  // 空知识或全pending同样不能编造亲历；不能为了拦截身后事先把未审事件入库。
  if (firstPersonExperience.test(narration) && !records.some((record) => record.firstPersonAllowed && mentions(record))) violations.add("unpermitted_first_person_experience");
  for (const record of records) {
    if (!mentions(record)) continue;
    if (!record.firstPersonAllowed && firstPersonExperience.test(narration)) violations.add(`${record.factId}:forbidden_first_person`);
    if (record.posthumous && !/听说|听闻|耳闻|后世|身后/u.test(reply)) violations.add(`${record.factId}:missing_posthumous_voice`);
    const attributions = [...reply.matchAll(/(?:据|依|按)(.{1,100}?)(?:记载|記載|所载|所載)/gu)];
    const citation = record.source.citationName ?? record.source.title;
    if ((record.tier === "sourced_anecdote" || record.allowedUsage.includes("attributed")) && !attributions.some((match) => match[1].includes(citation))) violations.add(`${record.factId}:missing_attribution`);
  }
  return [...violations];
}

/** 未授权文本只用来阻止泄漏，绝不作为提示词事实或引文白名单。 */
export function findForbiddenKnowledgeUsage(reply: string, friend: KnowledgeFriend): string[] {
  return friend.knowledge.flatMap((record) => {
    if (record.tier === "persona_expression") {
      return reply.includes(record.content) && /(?:曰|原话|原話|诗句|詩句|写过|寫過|当年|當年|史事|史書|史书)/u.test(reply)
        ? [`${record.factId}:persona_as_fact`] : [];
    }
    if (record.reviewStatus.status === "reviewed" && record.allowedUsage.includes("exact_quote")) return [];
    const fragments = record.exactQuote.split(/[，。！？；：、\n「」]/u).filter((part) => part.length >= 5);
    return fragments.some((part) => reply.includes(part)) ? [`${record.factId}:unauthorized_quote`] : [];
  });
}
