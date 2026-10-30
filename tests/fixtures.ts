import type { HotTopic, Source } from "@/lib/schemas";

// 仅在内存中使用的合成测试数据，不代表任何史实，也不进入 data/topics。
export function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "TEST-SOURCE",
    title: "合成测试来源",
    organization: "测试机构（虚构）",
    url: "https://example.com/test-evidence",
    supports: "仅用于测试来源关联",
    kind: "academic",
    status: "pending",
    ...overrides,
  };
}

export function makeTopic(overrides: Partial<HotTopic> = {}): HotTopic {
  return {
    id: "TEST-1",
    era: { label: "唐代", order: 4 },
    rumorEra: "不限定",
    coreContext: "合成测试背景",
    evidenceEra: "待定",
    eraReview: { status: "pending" },
    rank: 1,
    module: "trending",
    category: "合成测试",
    tags: ["测试"],
    title: "合成测试话题，非历史内容",
    coverUrl: "/covers/test-only.svg",
    coverAlt: "测试占位路径，不对应正式素材",
    author: {
      name: "测试账号",
      handle: "@test_author",
      bio: "仅用于自动化测试",
      avatarUrl: "/avatars/test-only.svg",
      fictitious: true,
    },
    body: "合成测试正文，不包含历史断言。",
    news: { outlet: "测试采闻社", lead: "合成测试导语", publishedAt: "2026-10-30T09:20:00+08:00", related: ["合成线索一", "合成线索二"] },
    simulatedHeat: 100,
    simulatedViews: 120,
    simulatedLikes: 10,
    simulatedComments: 6,
    simulatedReposts: 2,
    simulatedBookmarks: 3,
    comments: Array.from({ length: 6 }, (_, index) => ({
      id: `COMMENT-${index + 1}`,
      author: `测试网友${index + 1}`,
      role: "spectator",
      text: `第 ${index + 1} 条合成测试评论`,
      simulatedLikes: 0,
    })),
    claim: "这是一条用于校验的合成主张。",
    isTrue: false,
    reveal: {
      verdictHeadline: "测试结论",
      shortExplanation: "测试短解释",
      detailedExplanation: "测试详细解释",
      correctedClaim: "测试准确表述",
      funFact: "测试拓展说明",
    },
    sourceIds: ["TEST-SOURCE"],
    rewriteOptions: [
      { id: "A", text: "测试改写 A", isBest: true, feedback: "测试反馈 A" },
      { id: "B", text: "测试改写 B", isBest: false, feedback: "测试反馈 B" },
      { id: "C", text: "测试改写 C", isBest: false, feedback: "测试反馈 C" },
    ],
    aiFacts: ["合成测试事实"],
    aiLimitations: ["不能用于历史科普"],
    reviewStatus: "pending",
    ...overrides,
  };
}

export function makeTopics(count: number, trueCount = Math.ceil(count / 2)): HotTopic[] {
  return Array.from({ length: count }, (_, index) => makeTopic({
    id: `TEST-${index + 1}`,
    rank: index + 1,
    isTrue: index < trueCount,
  }));
}
