// @vitest-environment node
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedEntrySchema } from "@/lib/feed-schema";
import { getAllFeedEntries, getFeedEntryById, getSameTopicEntries, toPublicFeedEntry, validateFeedSet } from "@/lib/feed";
import { getAllTopics } from "@/lib/topics";
import PostPage, { generateMetadata } from "@/app/post/[id]/page";
import constraints from "./fixtures/display-constraints.json";

const topics = getAllTopics();
const ids = topics.map(({ id }) => id);
const entries = getAllFeedEntries();
const mapping = ["H01", "H01", "H02", "H02", "H03", "H03", "H04", "H04", "H05", "H06", "H07", "H07", "H08", "H09", "H09", "H10", "H11", "H12"];
const numbered = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`);

beforeEach(() => vi.stubEnv("CONTENT_MODE", "preview"));
afterEach(() => vi.unstubAllEnvs());

describe("独立信息流与审核题库", () => {
  it("44 条信息流：19 热搜、25 发现；14 题与 7:7 均衡", () => {
    expect(entries).toHaveLength(44);
    expect(new Set(entries.map(({ id }) => id)).size).toBe(44);
    expect(topics).toHaveLength(14);
    expect(topics.filter(({ isTrue }) => isTrue)).toHaveLength(7);
    expect(new Set(entries.map(({ topicId }) => topicId))).toEqual(new Set(ids));
    for (const [module, expectedIds] of [
      ["trending", ["H01", "H02", "H03", "H04", "H07", "H09", ...numbered("T", 12), "H14"]],
      ["discover", ["H05", "H06", "H08", "H10", "H11", "H12", ...numbered("P", 18), "H13"]],
    ] as const) {
      const members = entries.filter((entry) => entry.module === module);
      expect(members.map(({ id }) => id)).toEqual(expectedIds);
      expect(members.map(({ rank }) => rank)).toEqual(members.map((_, i) => i + 1));
    }
    expect(entries.filter(({ id }) => id.startsWith("T")).map(({ topicId }) => topicId)).toEqual(ids.slice(0, 12));
    expect(entries.filter(({ id }) => id.startsWith("P")).map(({ topicId }) => topicId)).toEqual(mapping);
  });

  it.each(entries)("$id 内容完整，答案与来源只取 $topicId，显示字段独立", (entry) => {
    const topic = topics.find(({ id }) => id === entry.topicId)!;
    expect(FeedEntrySchema.safeParse(entry).success).toBe(true);
    const publicEntry = toPublicFeedEntry(entry);
    expect(publicEntry.id).toBe(entry.id);
    expect(publicEntry.topicId).toBe(topic.id);
    expect(publicEntry.claim).toBe(topic.claim);
    expect(publicEntry.era).toEqual(topic.era);
    expect(publicEntry.reviewStatus).toBe(topic.reviewStatus);
    expect(publicEntry.body).toBe(entry.body);
    expect(publicEntry.module).toBe(entry.module);
    expect(publicEntry.format).toBe(entry.format);
    expect(publicEntry.news).toEqual(entry.news);
    expect(publicEntry.publishedAt).toBe(entry.publishedAt);
    expect(JSON.stringify(publicEntry)).not.toMatch(/"(?:isTrue|reveal|sourceIds|rewriteOptions|aiFacts|aiLimitations|eraReview|editorialReviewStatus|statisticsOrigin|fictionalFraming)"/);
    expect(entry.body.length).toBeGreaterThan(65);
    expect(entry.tags.length).toBeGreaterThan(0);
    expect(entry.comments).toHaveLength(6);
    expect(entry.comments[0].replies!.length).toBeGreaterThanOrEqual(2);
    expect(entry.author.handle).toMatch(/^@[a-z_]{3,20}$/);
    expect(entry.statisticsOrigin).toBe("design");
    expect(entry.editorialReviewStatus).toBe("pending");
    const copy = JSON.stringify({ title: entry.title, body: entry.body, news: entry.news, author: entry.author, tags: entry.tags, comments: entry.comments });
    expect(copy).not.toMatch(new RegExp(constraints.verdictPattern));
    for (const word of constraints.answerKeywords[entry.topicId as keyof typeof constraints.answerKeywords]) expect(copy, `${entry.id}: ${word}`).not.toContain(word);
    for (const word of [...constraints.hiddenUiWords, ...constraints.falseInteractionWords]) expect(copy, `${entry.id}: ${word}`).not.toContain(word);
    expect(copy).not.toContain(topic.reveal.correctedClaim);
    expect(entry.title).not.toMatch(/^#|#$/);
  });

  it("30 条新内容有独立标题、正文与封面路径；发现保留图文/聊天/手作/投票", () => {
    const added = entries.filter(({ id }) => /^[TP]/.test(id));
    expect(added).toHaveLength(30);
    for (const field of ["title", "body", "coverUrl"] as const) expect(new Set(added.map((entry) => entry[field])).size).toBe(30);
    expect(new Set(entries.filter(({ module }) => module === "discover").map(({ format }) => format))).toEqual(new Set(["post", "moments", "chat", "poll"]));
  });

  it("所有 30 个指定 WebP 文件存在且为有效 WebP 容器", () => {
    const added = entries.filter(({ id }) => /^[TP]/.test(id));
    expect(added).toHaveLength(30);
    const hashes = new Set<string>();
    for (const entry of added) {
      expect(entry.coverUrl).toBe(`/covers/feed/${entry.id.toLowerCase()}.webp`);
      expect(existsSync(`public${entry.coverUrl}`), entry.coverUrl).toBe(true);
      const bytes = readFileSync(`public${entry.coverUrl}`);
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
      hashes.add(createHash("sha256").update(bytes).digest("hex"));
    }
    expect(hashes.size).toBe(30);
  });

  it("拒绝坏映射、重复 ID、排名、答案字段、错误封面和断裂回复线程", () => {
    const mutate = (patch: Record<string, unknown>) => [{ ...entries[0], ...patch }, ...entries.slice(1)];
    expect(() => validateFeedSet(mutate({ topicId: "H99" }), ids)).toThrow(/topicId 不存在/);
    expect(() => validateFeedSet([...entries, entries[0]], ids)).toThrow(/ID 重复/);
    expect(() => validateFeedSet(mutate({ rank: 2 }), ids)).toThrow(/排名/);
    expect(() => validateFeedSet(mutate({ topicId: "H02" }), ids)).toThrow(/旧链接/);
    expect(() => validateFeedSet(mutate({ isTrue: true }), ids)).toThrow();
    const added = getFeedEntryById("T01")!;
    expect(FeedEntrySchema.safeParse({ ...added, coverUrl: "/covers/h01.webp" }).success).toBe(false);
    const broken = structuredClone(added);
    broken.comments[0].replies![0].replyTo = "missing";
    expect(FeedEntrySchema.safeParse(broken).success).toBe(false);
  });

  it.each(entries)("/post/$id 的页面与 metadata 使用内容 ID，旧链接和新链接都可用", async (entry) => {
    const props = { params: Promise.resolve({ id: entry.id }) };
    expect((await generateMetadata(props)).title).toBe(entry.title);
    const page = await PostPage(props);
    expect(page.props.backHref).toBe(`/${entry.module}`);
    expect(page.props.children.props.topic.id).toBe(entry.id);
    expect(page.props.children.props.topic.topicId).toBe(entry.topicId);
    expect(page.props.children.props.topicIds).toEqual(ids);
    expect(page.props.children.props.relatedEntries).toEqual(getSameTopicEntries(entry));
  });

  it.each(entries)("$id 同话题推荐完整、无自身、无其他主题、摘要不泄漏答案", (entry) => {
    const related = getSameTopicEntries(entry);
    expect(related.map(({ id }) => id)).toEqual(entries.filter((other) => other.topicId === entry.topicId && other.id !== entry.id).map(({ id }) => id));
    expect(related.length).toBe(["H13", "H14"].includes(entry.id) ? 0 : entries.filter((other) => other.topicId === entry.topicId).length - 1);
    for (const item of related) expect(Object.keys(item).sort()).toEqual(["coverAlt", "coverUrl", "id", "module", "title", "topicId"]);
  });
});
