import { FriendKnowledgeSchema, type FriendKnowledge } from "@/lib/friend-knowledge";

/** 纯合成审核夹具，绝不向真实数据写入审核签名。 */
export function makeKnowledge(patch: Partial<FriendKnowledge> = {}): FriendKnowledge {
  return FriendKnowledgeSchema.parse({
    sourceId: "test-source", factId: "test-fact", tier: "verified_fact", evidenceType: "primary_text",
    certainty: "confirmed", allowedUsage: ["paraphrase", "first_person", "exact_quote"],
    content: "合成测试记录，不是史料。", exactQuote: "测试原句。", subjects: ["测试材料"],
    sourceCompositionDate: { earliest: 740, latest: 740, note: "合成测试日期" },
    originalWorkDate: { earliest: 740, latest: 740, note: "合成测试日期" },
    eventDate: { earliest: 740, latest: 740, note: "合成测试日期" },
    lifetimeWork: true,
    speakerAttribution: { kind: "author_self_report", label: "合成测试作者自述" },
    reviewStatus: { status: "reviewed", reviewer: "Test reviewer", reviewedAt: "2026-10-31T00:00:00Z" },
    source: { title: "测试文献", url: "https://example.test/text", accessedAt: "2026-10-31T00:00:00Z", accessMethod: "本机合成夹具", accessStatus: "opened", originalText: "测试原句。" },
    ...patch,
  });
}

export function quoteKnowledge(quote: string, factId = "test-quote") {
  return makeKnowledge({ factId, exactQuote: quote, source: { ...makeKnowledge().source, originalText: quote } });
}
