// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import sourceIndex from "@/data/source-index.json";
import {
  CommentSchema,
  HotTopicSchema,
  ReviewStatusSchema,
  RewriteOptionSchema,
  SourceSchema,
  TopicProgressSchema,
} from "@/lib/schemas";
import { getAllTopics, validateContentSet } from "@/lib/topics";
import { makeSource, makeTopic, makeTopics } from "./fixtures";

const sources = [makeSource()];

describe("validateContentSet：当前题目的完整性规则", () => {
  it("接受阶段 A 的空题库及空来源索引", () => {
    expect(() => validateContentSet([], [], { expectedCount: 0 })).not.toThrow();
  });

  it("接受字段完整的单条 pending 话题，不要求凑满八条", () => {
    expect(() => validateContentSet([makeTopic()], sources, { expectedCount: 1 })).not.toThrow();
  });

  it("默认按当前题目数量验证，不强制部分题库真假平衡", () => {
    expect(() => validateContentSet(makeTopics(3, 0), sources)).not.toThrow();
  });

  it("接受顺序打乱但排名连续的题库", () => {
    expect(() => validateContentSet(makeTopics(3).reverse(), sources)).not.toThrow();
  });

  it("拒绝重复话题 id，即使排名不同", () => {
    const topics = makeTopics(2);
    topics[1].id = topics[0].id;
    expect(() => validateContentSet(topics, sources)).toThrow(/话题 id 重复/);
  });

  it("拒绝重复 rank，即使 id 不同", () => {
    const topics = makeTopics(2);
    topics[1].rank = 1;
    expect(() => validateContentSet(topics, sources)).toThrow(/rank 重复/);
  });

  it.each([0, -1, 1.5, Number.NaN])("拒绝无效排名 %s", (rank) => {
    expect(() => validateContentSet([makeTopic({ rank })], sources)).toThrow();
  });

  it.each([[2, 3], [1, 3], [1, 9]])("拒绝不从 1 连续排列的 rank：%j", (first, second) => {
    const topics = makeTopics(2);
    topics[0].rank = first;
    topics[1].rank = second;
    expect(() => validateContentSet(topics, sources)).toThrow(/rank 必须从 1 连续排列/);
  });

  it.each(["title", "claim", "coverUrl"] as const)("拒绝空白 %s", (field) => {
    for (const value of ["", " \n\t "]) {
      const topic = makeTopic({ [field]: value });
      expect(() => validateContentSet([topic], sources)).toThrow();
    }
  });

  it.each([undefined, null, {}])("拒绝缺失或不完整的 reveal：%j", (reveal) => {
    expect(() => validateContentSet([{ ...makeTopic(), reveal }], sources)).toThrow();
  });

  it.each([
    "verdictHeadline", "shortExplanation", "detailedExplanation", "correctedClaim", "funFact",
  ] as const)("拒绝 reveal.%s 为空白", (field) => {
    const topic = makeTopic();
    topic.reveal[field] = " \t ";
    expect(() => validateContentSet([topic], sources)).toThrow();
  });

  it.each(["aiFacts", "sourceIds"] as const)("拒绝空 %s 或空白数组项", (field) => {
    for (const value of [[], [""], [" \n "]]) {
      expect(() => validateContentSet([makeTopic({ [field]: value })], sources)).toThrow();
    }
  });

  it("拒绝少于 6 条评论", () => {
    const topic = makeTopic();
    topic.comments.pop();
    expect(() => validateContentSet([topic], sources)).toThrow(/至少需要 6 条评论/);
  });

  it("拒绝数量足够但含空白文本的评论", () => {
    const topic = makeTopic();
    topic.comments[5].text = " \n ";
    expect(() => validateContentSet([topic], sources)).toThrow();
  });

  it("接受超过 6 条有内容的评论", () => {
    const topic = makeTopic();
    topic.comments.push({ ...topic.comments[0], id: "COMMENT-7" });
    expect(() => validateContentSet([topic], sources)).not.toThrow();
  });

  it("拒绝任意未知 sourceId，错误说明话题与来源", () => {
    const topic = makeTopic({ sourceIds: ["TEST-SOURCE", "MISSING"] });
    expect(() => validateContentSet([topic], sources)).toThrow(/TEST-1 的 sourceId 不存在：MISSING/);
  });

  it("有话题时不能使用空来源索引", () => {
    expect(() => validateContentSet([makeTopic()], [])).toThrow(/sourceId 不存在/);
  });

  it("接受已存在的多个来源", () => {
    const topic = makeTopic({ sourceIds: ["TEST-SOURCE", "SECOND"] });
    expect(() => validateContentSet([topic], [...sources, makeSource({ id: "SECOND" })])).not.toThrow();
  });

  it("拒绝来源索引中重复的 id，避免关联歧义", () => {
    expect(() => validateContentSet([makeTopic()], [makeSource(), makeSource()])).toThrow(/来源 id 重复/);
  });

  it.each([0, 1, 2, 4])("拒绝 %i 个改写选项", (count) => {
    const topic = makeTopic();
    topic.rewriteOptions = Array.from({ length: count }, (_, index) => ({
      ...topic.rewriteOptions[0], id: String(index), isBest: index === 0,
    }));
    expect(() => validateContentSet([topic], sources)).toThrow(/恰好有 3 个改写选项/);
  });

  it.each([0, 2, 3])("拒绝 %i 个 isBest: true", (bestCount) => {
    const topic = makeTopic();
    topic.rewriteOptions.forEach((option, index) => { option.isBest = index < bestCount; });
    expect(() => validateContentSet([topic], sources)).toThrow(/恰好有 1 个 isBest/);
  });

  it.each([0, 1, 2])("接受唯一正确选项位于索引 %i", (bestIndex) => {
    const topic = makeTopic();
    topic.rewriteOptions.forEach((option, index) => { option.isBest = index === bestIndex; });
    expect(() => validateContentSet([topic], sources)).not.toThrow();
  });

  it("按 8 条真实题目启用 expectedCount=8 与真假 4:4 校验", () => {
    const topics = getAllTopics();
    expect(() => validateContentSet(topics, sourceIndex, { expectedCount: 8 })).not.toThrow();
    expect(topics.filter((topic) => !topic.isTrue).map((topic) => topic.id)).toEqual(["H01", "H03", "H05", "H07"]);
    expect(topics.filter((topic) => topic.isTrue).map((topic) => topic.id)).toEqual(["H02", "H04", "H06", "H08"]);
  });

  it("真实题库缺项或破坏 4:4 时校验失败", () => {
    const topics = getAllTopics();
    expect(() => validateContentSet(topics.slice(0, 7), sourceIndex, { expectedCount: 8 })).toThrow(/题目数量应为 8/);
    const unbalanced = topics.map((topic) => topic.id === "H06" ? { ...topic, isTrue: false } : topic);
    expect(() => validateContentSet(unbalanced, sourceIndex, { expectedCount: 8 })).toThrow(/真假比例必须为 4:4/);
  });

  it("阶段2第2部分为 H01–H08，排名连续，题目及来源全部 pending 且没有审核签名", () => {
    const topics = getAllTopics();
    expect(topics.map((topic) => [topic.id, topic.rank, topic.isTrue])).toEqual([
      ["H01", 1, false], ["H02", 2, true], ["H03", 3, false], ["H04", 4, true],
      ["H05", 5, false], ["H06", 6, true], ["H07", 7, false], ["H08", 8, true],
    ]);
    expect(topics.every((topic) => topic.reviewStatus === "pending")).toBe(true);
    expect(sourceIndex.map((source) => source.id)).toEqual([
      "S-H01-01", "S-H02-01", "S-H02-02", "S-H02-03",
      "S-H03-01", "S-H03-02", "S-H03-03", "S-H04-01", "S-H04-02", "S-H04-03",
      "S-H05-01", "S-H06-01", "S-H06-02", "S-H07-01", "S-H08-01",
    ]);
    const locators: Record<string, string> = { "S-H02-01": "卷三·马行街铺席", "S-H02-02": "卷二·饮食果子" };
    for (const source of sourceIndex) {
      expect(source.status).toBe("pending");
      expect(source.locator).toBe(locators[source.id] ?? "");
    }
    const raw = JSON.stringify([topics, sourceIndex]);
    for (const field of ["reviewBy", "reviewedAt", "verifiedBy", "verifiedAt"]) expect(raw).not.toContain(`"${field}"`);
  });

  it.each([
    { id: "H01", best: "A", sources: ["S-H01-01"], corrected: "李白与杜甫在唐代相识并有交游记载；现代互关说法只是创作。" },
    { id: "H02", best: "C", sources: ["S-H02-01", "S-H02-02", "S-H02-03"], corrected: "宋代部分城市已有购买现成饭食、代买送食等服务，与现代外卖平台不同。" },
    { id: "H03", best: "C", sources: ["S-H03-01", "S-H03-02", "S-H03-03"], corrected: "唐代有胡椒、花椒等辛香料，但来自美洲的辣椒约在明末传入中国。" },
    { id: "H04", best: "B", sources: ["S-H04-01", "S-H04-02", "S-H04-03"], corrected: "北宋四川出现交子，并经历民间使用到官府发行的发展过程。" },
    { id: "H05", best: "B", sources: ["S-H05-01"], corrected: "唐三彩是多种釉色的唐代彩釉陶器，并非严格只有三种颜色。" },
    { id: "H06", best: "A", sources: ["S-H06-01", "S-H06-02"], corrected: "战国已有可借助冰块冷却酒饮的冰鉴等器具，不等于电冰箱。" },
    { id: "H07", best: "C", sources: ["S-H07-01"], corrected: "蹴鞠在宋代以前已有记载，宋代进一步发展，不能说起源于宋代。" },
    { id: "H08", best: "B", sources: ["S-H08-01"], corrected: "唐代遗址发现带植毛孔的牙刷柄，可证明当时已有这种器具。" },
  ])("$id 保持文案模板、八条四角色评论、指定改写及本题事实来源前缀", ({ id, best, sources, corrected }) => {
    const topic = getAllTopics().find((topic) => topic.id === id)!;
    expect(topic.author.fictitious).toBe(true);
    expect([...topic.title].length).toBeGreaterThanOrEqual(20);
    expect([...topic.title].length).toBeLessThanOrEqual(45);
    expect([...topic.body].length).toBeGreaterThanOrEqual(80);
    expect([...topic.body].length).toBeLessThanOrEqual(150);
    expect(topic.comments).toHaveLength(8);
    expect(new Set(topic.comments.map((comment) => comment.id)).size).toBe(8);
    expect(new Set(topic.comments.map((comment) => comment.role))).toEqual(new Set(["spectator", "troll", "history_nerd", "in_world"]));
    expect(topic.sourceIds).toEqual(sources);
    expect(topic.rewriteOptions.map((option) => option.id)).toEqual(["A", "B", "C"]);
    expect(topic.rewriteOptions.find((option) => option.isBest)).toMatchObject({ id: best, text: corrected });
    expect(topic.reveal.correctedClaim).toBe(corrected);
    expect(topic.aiLimitations.length).toBeGreaterThan(0);
    for (const fact of topic.aiFacts) {
      expect(topic.sourceIds).toContain(fact.match(/^\[([^\]]+)\]/)?.[1]);
    }
  });

  it("真实题目封面与所有头像使用已登记的本地原创 SVG", () => {
    const assets = new Set(getAllTopics().flatMap((topic) => [topic.coverUrl, topic.author.avatarUrl, ...topic.comments.map((comment) => comment.avatar!)]));
    const licenses = readFileSync(path.join(process.cwd(), "docs/ASSET_LICENSES.md"), "utf8");
    for (const asset of assets) {
      expect(asset).toMatch(/^\/(covers|avatars)\/[\w-]+\.svg$/);
      const svg = readFileSync(path.join(process.cwd(), "public", asset), "utf8");
      expect(svg).toContain("艺术创作·非史料");
      expect(svg).not.toMatch(/(?:href|src)=["']https?:/);
      expect(licenses).toContain(`public${asset}`);
    }
  });

});

describe("validateContentSet：expectedCount=8 的首发校验（仅内存 fixture）", () => {
  it("接受恰好 8 条且真假 4:4", () => {
    expect(() => validateContentSet(makeTopics(8, 4), sources, { expectedCount: 8 })).not.toThrow();
  });

  it.each([0, 7, 9])("拒绝 %i 条题目", (count) => {
    expect(() => validateContentSet(makeTopics(count), sources, { expectedCount: 8 })).toThrow(/题目数量应为 8/);
  });

  it.each([0, 3, 5, 8])("拒绝 8 条中 %i 真、其余假的比例", (trueCount) => {
    expect(() => validateContentSet(makeTopics(8, trueCount), sources, { expectedCount: 8 })).toThrow(/真假比例必须为 4:4/);
  });

  it("其他 expectedCount 也检查数量", () => {
    expect(() => validateContentSet(makeTopics(1), sources, { expectedCount: 2 })).toThrow(/题目数量应为 2/);
  });
});

describe("7.3 的类型及 Zod 字段约束", () => {
  it.each(["pending", "reviewed", "rejected"])("保留合法审核状态 %s", (status) => {
    expect(ReviewStatusSchema.parse(status)).toBe(status);
    expect(SourceSchema.parse({ ...makeSource(), status }).status).toBe(status);
    const topic = HotTopicSchema.parse({ ...makeTopic(), reviewStatus: status });
    expect(topic.reviewStatus).toBe(status);
  });

  it("拒绝未知审核状态", () => {
    expect(() => validateContentSet([{ ...makeTopic(), reviewStatus: "verified" }], sources)).toThrow();
    expect(() => validateContentSet([makeTopic()], [{ ...makeSource(), status: "verified" }])).toThrow();
  });

  it.each(["primary", "museum", "academic", "public_culture"])("接受来源种类 %s", (kind) => {
    expect(SourceSchema.parse({ ...makeSource(), kind }).kind).toBe(kind);
  });

  it("拒绝无效来源 URL 和缺失的具体支持点", () => {
    expect(() => validateContentSet([makeTopic()], [makeSource({ url: "not-a-url" })])).toThrow();
    expect(() => validateContentSet([makeTopic()], [makeSource({ supports: " " })])).toThrow();
  });

  it("允许来源定位为空，且不生成虚构审核人或时间", () => {
    const source = SourceSchema.parse(makeSource({ locator: "" }));
    expect(source.locator).toBe("");
    expect(source.verifiedAt).toBeUndefined();
    expect(source.verifiedBy).toBeUndefined();
  });

  it.each(["spectator", "troll", "history_nerd", "in_world"])("接受评论角色 %s", (role) => {
    expect(CommentSchema.parse({ ...makeTopic().comments[0], role }).role).toBe(role);
  });

  it("拒绝未知评论角色、负数或非整数模拟统计", () => {
    const comment = makeTopic().comments[0];
    expect(CommentSchema.safeParse({ ...comment, role: "admin" }).success).toBe(false);
    expect(CommentSchema.safeParse({ ...comment, simulatedLikes: -1 }).success).toBe(false);
    expect(HotTopicSchema.safeParse(makeTopic({ simulatedHeat: 1.5 })).success).toBe(false);
  });

  it("架空账号标识必须为 true，isTrue 不接受字符串", () => {
    const topic = makeTopic();
    expect(HotTopicSchema.safeParse({ ...topic, author: { ...topic.author, fictitious: false } }).success).toBe(false);
    expect(HotTopicSchema.safeParse({ ...topic, isTrue: "false" }).success).toBe(false);
  });

  it("改写选项的文本和反馈均不能为空", () => {
    const option = makeTopic().rewriteOptions[0];
    expect(RewriteOptionSchema.safeParse({ ...option, text: "" }).success).toBe(false);
    expect(RewriteOptionSchema.safeParse({ ...option, feedback: " " }).success).toBe(false);
  });

  it("进度支持最小状态与显式 false，不默认为已揭晓", () => {
    expect(TopicProgressSchema.parse({ topicId: "TEST-1", revealed: false })).toEqual({ topicId: "TEST-1", revealed: false });
    const progress = TopicProgressSchema.parse({
      topicId: "TEST-1", selectedAnswer: false, submittedAt: "2026-10-29T12:00:00Z",
      revealed: true, selectedRewriteOptionId: "C",
    });
    expect(progress.selectedAnswer).toBe(false);
    expect(progress.selectedRewriteOptionId).toBe("C");
    expect(TopicProgressSchema.safeParse({ topicId: "TEST-1" }).success).toBe(false);
    expect(TopicProgressSchema.safeParse({ topicId: "TEST-1", revealed: "false" }).success).toBe(false);
  });
});
