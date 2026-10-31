import { z } from "zod";
import type { Source } from "./schemas";

const text = z.string().trim().min(1);
const year = z.number().int().min(-4000).max(3000).refine((value) => value !== 0, "历史纪年无零年；公元前用负数");
export const LifespanSchema = z.strictObject({ birthYear: year.nullable(), deathYear: year.nullable(), note: text })
  .refine((value) => value.birthYear === null || value.deathYear === null || value.birthYear <= value.deathYear, "生卒顺序错误");
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
  allowedUsage: z.array(z.enum(["paraphrase", "first_person", "text_ownership", "exact_quote", "attributed", "persona_expression"])).min(1)
    .refine((values) => new Set(values).size === values.length, "使用权限不能重复"),
  content: text.max(12000),
  // 不 trim、不转换繁简、不修标点。空串表示没有任何逐字引用权限。
  exactQuote: z.string().max(12000),
  subjects: z.array(text).min(1),
  sourceCompositionDate: KnowledgeDateSchema.nullable(),
  originalWorkDate: KnowledgeDateSchema.nullable(),
  eventDate: KnowledgeDateSchema.nullable(),
  lifetimeWork: z.boolean(),
  speakerAttribution: z.strictObject({
    kind: z.enum(["author_text", "author_self_report", "recorded_speech", "third_person_record", "modern_description", "legacy_summary", "persona_expression"]),
    label: text,
  }),
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
  if (record.allowedUsage.includes("text_ownership") && (!record.lifetimeWork || !["author_text", "author_self_report"].includes(record.speakerAttribution.kind))) issue("作品归属须为作者生前作品");
  if (record.speakerAttribution.kind === "modern_description" && record.allowedUsage.some((usage) => ["first_person", "text_ownership", "exact_quote"].includes(usage))) issue("现代说明不能授予人物原话或亲历权限");
  if (record.evidenceType === "museum" && record.speakerAttribution.kind !== "modern_description") issue("馆方说明须标为现代说明");
  if (record.allowedUsage.includes("first_person") && ["author_text", "modern_description", "legacy_summary", "persona_expression"].includes(record.speakerAttribution.kind)) issue("该归属不授亲历权限");
  if (record.speakerAttribution.kind === "recorded_speech" && (!record.allowedUsage.includes("attributed") || !record.source.originalText.startsWith("子曰"))) issue("归语例外须有明确子曰及文本归属");
  if (record.exactQuote && !record.source.originalText.includes(record.exactQuote)) issue("exactQuote 必须连续逐字出自核对原文");
  if (record.tier === "persona_expression") {
    if (record.certainty !== "creative" || record.evidenceType !== "persona" || record.exactQuote || record.allowedUsage.some((usage) => usage !== "persona_expression")) issue("人设表达不能获得事实或原话权限");
  } else {
    if (record.evidenceType === "persona" || record.certainty === "creative" || record.allowedUsage.includes("persona_expression")) issue("事实不能借用人设权限");
    if (record.tier === "verified_fact" && record.certainty !== "confirmed") issue("确定事实须 confirmed");
    if (record.tier === "sourced_anecdote" && !record.allowedUsage.includes("attributed")) issue("文献记述须注明出处");
    if (record.reviewStatus.status === "reviewed" && !["opened", "legacy_review"].includes(record.source.accessStatus)) issue("未打开正文不能审核为可用事实");
  }
});

export type FriendKnowledge = z.infer<typeof FriendKnowledgeSchema>;
type KnowledgeFriend = { lifespan: z.infer<typeof LifespanSchema>; knowledge: FriendKnowledge[]; sourceIds: string[] };

export function getKnowledgeLifecycle(friend: Pick<KnowledgeFriend, "lifespan">, record: Pick<FriendKnowledge, "sourceCompositionDate" | "eventDate">) {
  const { birthYear, deathYear } = friend.lifespan;
  const posthumous = deathYear !== null && record.sourceCompositionDate !== null && record.sourceCompositionDate.latest > deathYear;
  const eventPosthumous = deathYear !== null && record.eventDate !== null && record.eventDate.latest > deathYear;
  const contemporary = birthYear !== null && deathYear !== null && record.eventDate !== null && record.eventDate.earliest >= birthYear && record.eventDate.latest <= deathYear;
  return { posthumous, eventPosthumous, contemporary };
}

/** 旧题来源只继承已有审核范围，不从 supports/title 自动提取引文或授予亲历。 */
function legacyKnowledge(source: Source): FriendKnowledge | undefined {
  if (source.status !== "reviewed" || !source.verifiedBy || !source.verifiedAt) return;
  const result = FriendKnowledgeSchema.safeParse({
    sourceId: source.id, factId: `legacy:${source.id}`, tier: "sourced_anecdote",
    evidenceType: "legacy_reviewed_source", certainty: "reported", allowedUsage: ["paraphrase", "attributed"],
    content: source.supports, exactQuote: "", subjects: [source.title], sourceCompositionDate: null, originalWorkDate: null, eventDate: null,
    lifetimeWork: false, speakerAttribution: { kind: "legacy_summary", label: "继承已审来源的有限转述" },
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
  return records.filter((record, index) => records.findIndex((other) => other.factId === record.factId) === index).map((record) => {
    const lifecycle = getKnowledgeLifecycle(friend, record);
    const kind = record.speakerAttribution.kind;
    const authorReport = kind === "author_self_report" && record.lifetimeWork && record.eventDate === null;
    const firstPersonAllowed = record.allowedUsage.includes("first_person") && !lifecycle.eventPosthumous && (lifecycle.contemporary || authorReport);
    const firstPersonMode = firstPersonAllowed ? kind === "recorded_speech" ? "literary" : "limited_event" : "none";
    const textOwnershipAllowed = record.allowedUsage.includes("text_ownership") && record.lifetimeWork;
    const sourceCitation = record.source.citationName ?? record.source.title;
    return {
      ...record, ...lifecycle, firstPersonAllowed, firstPersonMode, textOwnershipAllowed,
      content: record.allowedUsage.includes("paraphrase") ? record.content : "",
      exactQuote: record.allowedUsage.includes("exact_quote") ? record.exactQuote : "",
      allowedUsage: record.allowedUsage.filter((usage) => usage !== "first_person" || firstPersonAllowed),
      voiceConstraint: lifecycle.eventPosthumous ? "eventPosthumous：事件在身后，须听闻后世，禁止亲历。"
        : kind === "modern_description" ? "现代馆方说明只支持窄命题转述，机构归属保留在来源记录；不得朗读为本人原话或回忆参观现代展馆。"
          : firstPersonMode === "literary" ? "仅作传世论语归语范围内的文学化第一人称，不声称录音式逐字确定，不自称编写或读过论语。"
            : firstPersonAllowed ? "仅可谈本条生前事件或作者自述；不扩写时间、现场、私人对话或独力成就。"
              : textOwnershipAllowed ? "允许说我的这篇作品写道；日期未知，不编创作哪年哪地，不把诗意作实录。"
                : `必须以据${sourceCitation}记载的口吻，表明是文献记述，不还原现场。`,
      attributionConstraint: kind === "modern_description" ? "现代机构归属供来源卡追溯，不要求古人口吻讲馆方说。"
        : record.allowedUsage.includes("attributed") ? `据${sourceCitation}记载；${lifecycle.posthumous ? "成书在身后，不得声称读过该书；生前事件权限单独判定。" : "保留文本归属。"}` : "保留本条 certainty 与限制。",
    };
  });
}

export type ChatKnowledge = ReturnType<typeof getChatKnowledge>[number];

/** 针对被谈及的材料执行口吻校验；不把情绪闲聊强行变成文献转述。 */
export function findKnowledgeOutputViolations(reply: string, records: ChatKnowledge[]): string[] {
  const violations = new Set<string>();
  const firstPersonExperience = /(?:^|[，。！？；：,.!?;:\n）)])\s*(?:我|吾|朕|某|余|丘|甫|光|亮|本汗|守仁|逸少|羲之|易安|东坡|老夫)(?:是|早就)?(?:当年|当时|那年|曾经|曾|亲眼|亲自|亲历|记得|还记得|读过|看过|见过|写过|编过|编定|参与|主持|下令|命人|去过|(?:就|也)?在场|在.{0,12}(?:见|读|看|写|游|修|治|建))/u;
  const firstPersonSpeech = /(?:我|吾|丘)(?:确实|亲口|逐字|曾经|曾)?(?:说过|說過|说的|說的)/u;
  const narration = reply.replace(/[“「『"].*?[”」』"]/gu, "");
  const mentions = (record: ChatKnowledge) => record.subjects.some((subject) => reply.includes(subject)) || Boolean(record.exactQuote && reply.includes(record.exactQuote));
  // 空知识或全pending同样不能编造亲历；不能为了拦截身后事先把未审事件入库。
  if (firstPersonExperience.test(narration) && !records.some((record) => record.firstPersonMode === "limited_event" && mentions(record))) violations.add("unpermitted_first_person_experience");
  for (const record of records) {
    const citation = record.source.citationName ?? record.source.title;
    if ((record.posthumous || record.speakerAttribution.kind === "modern_description") && narration.includes(citation) && /(?:读过|看过|编过|编写|编定|写成|参观)/u.test(narration)) violations.add(`${record.factId}:source_not_experience`);
    if (!mentions(record)) continue;
    if ((!record.firstPersonAllowed || record.firstPersonMode === "literary") && firstPersonExperience.test(narration)) violations.add(`${record.factId}:forbidden_first_person`);
    if (record.speakerAttribution.kind === "third_person_record" && firstPersonSpeech.test(narration)) violations.add(`${record.factId}:not_personal_speech`);
    if (record.speakerAttribution.kind === "recorded_speech" && /(?:确实|亲口|逐字|录音).{0,8}(?:说过|說過|说的|原话)/u.test(narration)) violations.add(`${record.factId}:unqualified_speech`);
    if (record.textOwnershipAllowed && record.originalWorkDate === null && /(?:那年|当年|\d{3,4}年|\d{1,2}岁).{0,16}(?:写|作)|(?:写|作).{0,12}(?:那年|\d{3,4}年)/u.test(narration)) violations.add(`${record.factId}:unknown_creation_date`);
    if (record.eventPosthumous && !/听说|听闻|耳闻|后世|身后/u.test(reply)) violations.add(`${record.factId}:missing_posthumous_voice`);
    const attributions = [...reply.matchAll(/(?:据|依|按)(.{1,100}?)(?:记载|記載|所载|所載)/gu)];
    if (record.allowedUsage.includes("attributed") && record.speakerAttribution.kind !== "modern_description" && !attributions.some((match) => match[1].includes(citation))) violations.add(`${record.factId}:missing_attribution`);
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
