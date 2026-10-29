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

  it("按当前真实题目数量校验仓库数据", () => {
    const topics = getAllTopics();
    expect(() => validateContentSet(topics, sourceIndex, { expectedCount: topics.length })).not.toThrow();
  });

  it("阶段 B 真实题库只有 H03，排名 1，全部保留 pending 且没有审核签名", () => {
    const topics = getAllTopics();
    expect(topics.map((topic) => topic.id)).toEqual(["H03"]);
    expect(topics[0].rank).toBe(1);
    expect(topics[0].isTrue).toBe(false);
    expect(topics[0].reviewStatus).toBe("pending");
    expect(sourceIndex.map((source) => source.id)).toEqual(["S-H03-01", "S-H03-02", "S-H03-03"]);
    expect(sourceIndex.every((source) => source.status === "pending" && source.locator === "")).toBe(true);
    const raw = JSON.stringify([topics, sourceIndex]);
    for (const field of ["reviewBy", "reviewedAt", "verifiedBy", "verifiedAt"]) expect(raw).not.toContain(`"${field}"`);
    expect(topics[0].comments).toHaveLength(8);
    expect(new Set(topics[0].comments.map((comment) => comment.role)).size).toBe(4);
    expect(topics[0].rewriteOptions.find((option) => option.isBest)?.id).toBe("C");
    for (const fact of topics[0].aiFacts) {
      expect(topics[0].sourceIds).toContain(fact.match(/^\[([^\]]+)\]/)?.[1]);
    }
  });

  it("真实题目封面与所有头像使用已登记的本地原创 SVG", () => {
    const topic = getAllTopics()[0];
    const assets = new Set([topic.coverUrl, topic.author.avatarUrl, ...topic.comments.map((comment) => comment.avatar!)]);
    const licenses = readFileSync(path.join(process.cwd(), "docs/ASSET_LICENSES.md"), "utf8");
    for (const asset of assets) {
      expect(asset).toMatch(/^\/(covers|avatars)\/[\w-]+\.svg$/);
      const svg = readFileSync(path.join(process.cwd(), "public", asset), "utf8");
      expect(svg).toContain("艺术创作·非史料");
      expect(svg).not.toMatch(/(?:href|src)=["']https?:/);
      expect(licenses).toContain(`public${asset}`);
    }
  });

  it.todo("8条及4:4待阶段2补齐（真实题库，不以合成 fixture 代替正式内容）");
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
