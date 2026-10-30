import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostExperience } from "@/components/post/PostExperience";
import { discussionPrompt } from "@/lib/discussion-prompt";
import { toPublicTopic } from "@/lib/public-topic";
import { getAllTopics } from "@/lib/topics";
import constraints from "./fixtures/display-constraints.json";
import integrity from "./fixtures/content-integrity.json";
import approvedEraReview from "./fixtures/approved-era-review.json";

const topics = getAllTopics();
const topicIds = topics.map(({ id }) => id);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("v0.21.0 展示内容边界", () => {
  it("旧题原指纹不变；来源只放行登记的 H14 扩充，其余旧来源逐字段不变", () => {
    const baselineBytes = readFileSync("tests/fixtures/source-index-v0.23.0.json");
    const canonicalBaselineBytes = Buffer.from(baselineBytes.toString("utf8").replaceAll("\r\n", "\n"));
    expect(createHash("sha256").update(canonicalBaselineBytes).digest("hex")).toBe(integrity.sourceIndexSha256);
    const baseline = JSON.parse(baselineBytes.toString());
    const current = JSON.parse(readFileSync("data/source-index.json", "utf8"));
    expect(current.slice(0, 28).map((source: { id: string }) => source.id)).toEqual(baseline.map((source: { id: string }) => source.id));
    for (const original of baseline) {
      const updated = current.find((source: { id: string }) => source.id === original.id);
      if (original.id !== "S-H02-01") { expect(updated).toEqual(original); continue; }
      const { supports, status, verifiedAt, verifiedBy, url, ...rest } = updated;
      expect({ ...rest, supports: original.supports, status: original.status, verifiedAt: original.verifiedAt, verifiedBy: original.verifiedBy, url: original.url }).toEqual(original);
      expect(supports.startsWith(original.supports + " H14 新增支持段")).toBe(true);
      expect(supports).toContain("夜市直至三更盡，才五更又復開張。如要鬧去處，通曉不絕。");
      expect(status).toBe("reviewed");
      expect(verifiedBy).toBe("Giotto");
      expect(verifiedAt).toBe("2026-10-30T09:53:00-07:00");
      expect(url).toBe("https://zh.wikisource.org/wiki/東京夢華錄/卷三");
    }
    expect(topicIds.slice(0, 12).toSorted()).toEqual(Object.keys(integrity.protectedTopicSha256).toSorted());
    for (const topic of topics.slice(0, 12)) {
      // 从原始 JSON 比较，避免 Schema 丢弃或转换字段掩盖差异。
      const raw = JSON.parse(readFileSync(`data/topics/${topic.id.toLowerCase()}.json`, "utf8"));
      const { title: _title, body: _body, tags: _tags, comments: _comments, author, news, ...rest } = raw;
      const { name: _name, bio: _bio, ...protectedAuthor } = author;
      const protectedFields = { ...rest, author: protectedAuthor };
      const eraPatch = approvedEraReview[topic.id as keyof typeof approvedEraReview];
      if (eraPatch) {
        // 先逐字段核对本次明确批准的值，再还原到改写前元数据计算原指纹。
        for (const [field, value] of Object.entries(eraPatch.after)) expect(raw[field], `${topic.id}.${field}`).toEqual(value);
        Object.assign(protectedFields, eraPatch.before);
      }
      if (news) {
        const { lead: _lead, related: _related, ...protectedNews } = news;
        protectedFields.news = protectedNews;
      }
      const hash = createHash("sha256").update(JSON.stringify(canonical(protectedFields))).digest("hex");
      expect(hash, topic.id).toBe(integrity.protectedTopicSha256[topic.id as keyof typeof integrity.protectedTopicSha256]);
    }
  });

  it.each(topics)("$id 题面、导语、全部评论与回复无本题答案关键词；两模块均可查看讨论", (topic) => {
    const keywords = constraints.answerKeywords[topic.id as keyof typeof constraints.answerKeywords];
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.some((word) => JSON.stringify({ reveal: topic.reveal, facts: topic.aiFacts }).includes(word))).toBe(true);
    const publicTopic = toPublicTopic(topic);
    // 主年代沿用已审字段；这里只检查本轮展示文案及判题主张。
    const copy = JSON.stringify({ title: topic.title, body: topic.body, news: topic.news, claim: topic.claim, tags: topic.tags, author: topic.author, coverAlt: topic.coverAlt, comments: topic.comments, prompt: discussionPrompt(topic.id) });
    expect(copy).not.toContain(topic.reveal.correctedClaim);
    expect(copy).not.toMatch(new RegExp(constraints.verdictPattern));
    for (const word of keywords) expect(copy, `${topic.id}: ${word}`).not.toContain(word);
    expect(topic.title).not.toMatch(/^#|#$/);

    const { container } = render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    const comments = screen.getByRole("region", { name: topic.module === "trending" ? "读者评论" : "评论区" });
    expect(comments.classList.contains("news-comments")).toBe(topic.module === "trending");
    const expand = screen.getByRole("button", { name: /展开更多评论/ });
    fireEvent.click(expand);
    expect(comments.querySelectorAll("#post-comments > li")).toHaveLength(topic.comments.length);
    expect(comments.querySelector("[data-reply-id] .author-badge")).toBeTruthy();
    expect(container.querySelector('a[href="#task-heading"]')).toBeTruthy();
    expect(container.querySelector("textarea, input[type=text], [contenteditable=true]")).toBeNull();
    const visibleCopy = [...container.querySelectorAll(".post-title, .post-body, .news-lead, .news-related, .comments-panel, .post-invitation")].map((node) => node.textContent).join("\n");
    for (const word of keywords) expect(visibleCopy, `${topic.id}: ${word}`).not.toContain(word);
    expect(visibleCopy).not.toMatch(new RegExp(constraints.verdictPattern));
    const accessibleCopy = [container.textContent, ...[...container.querySelectorAll("img")].map((image) => image.alt), ...[...container.querySelectorAll("[aria-label]")].map((node) => node.getAttribute("aria-label"))].join("\n");
    for (const word of [...constraints.hiddenUiWords, ...constraints.falseInteractionWords]) expect(accessibleCopy).not.toContain(word);
    expect(fetch).not.toHaveBeenCalled();
  });
});
