// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllTopics, getAvailableTopics, getSourcesForTopic } from "@/lib/topics";
import { getAllFeedEntries, getAvailableFeedEntries, getAvailableFeedEntryById, toPublicFeedEntry } from "@/lib/feed";
import { EraSchema, isLaterEra } from "@/lib/era";
import { POST as verdict } from "@/app/api/verdict/route";
import { POST as ask } from "@/app/api/ask/route";
import { POST as chat } from "@/app/api/chat/route";
import PostPage, { generateMetadata } from "@/app/post/[id]/page";
import { buildAskMessages } from "@/lib/ask-context";
import sourceIndex from "@/data/source-index.json";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const candidates = getAllTopics().slice(12, 14);
const request = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });

describe("Phase 4 已审新题与展示审核边界", () => {
  it("秦位于战国与汉之间，旧时代序号不变", () => {
    const qin = EraSchema.parse({ label: "秦", order: 2.5 });
    expect(isLaterEra(qin, { label: "战国", order: 2 })).toBe(true);
    expect(isLaterEra({ label: "汉", order: 3 }, qin)).toBe(true);
    expect(isLaterEra(qin, { label: "唐代", order: 4 })).toBe(false);
    expect(EraSchema.safeParse({ label: "秦", order: 3 }).success).toBe(false);
  });

  it.each(["formal", "", "invalid"])("%j 模式包含二十二题；H13/H14 列表、详情、metadata 和判题可用", async (mode) => {
    vi.stubEnv("CONTENT_MODE", mode);
    vi.stubEnv("AI_API_KEY", "");
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect(getAvailableTopics().map(({ id }) => id)).toEqual(getAllTopics().map(({ id }) => id));
    expect(getAvailableTopics()).toHaveLength(22);
    expect(getAvailableFeedEntries()).toHaveLength(52);
    for (const topic of candidates) {
      expect(getAvailableFeedEntryById(topic.id)?.editorialReviewStatus).toBe("reviewed");
      expect((await generateMetadata({ params: Promise.resolve({ id: topic.id }) })).title).toBe(topic.title);
      const page = await PostPage({ params: Promise.resolve({ id: topic.id }) });
      expect(page.props.children.props.topicIds).toHaveLength(22);
      const response = await verdict(request({ topicId: topic.id, answer: topic.isTrue }));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const result = await response.json();
      expect(result.isCorrect).toBe(true);
      expect(result.sources.every(({ status }: { status: string }) => status === "reviewed")).toBe(true);
      expect((await ask(request({ topicId: topic.id, question: "本题依据是什么？" }))).status).toBe(503);
      expect((await chat(request({ friendId: "libai", message: "聊聊它", sharedTopicId: topic.id }))).status).toBe(503);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it.each(["formal", "preview"])("%s 为二十二题、二十三热搜和二十九发现；已审来源完整且无配置时不调用 AI", async (mode) => {
    vi.stubEnv("CONTENT_MODE", mode); vi.stubEnv("AI_API_KEY", "");
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect(getAvailableTopics()).toHaveLength(22);
    expect(getAvailableFeedEntries().filter(({ module }) => module === "trending")).toHaveLength(23);
    expect(getAvailableFeedEntries().filter(({ module }) => module === "discover")).toHaveLength(29);
    for (const topic of candidates) {
      const entry = getAvailableFeedEntryById(topic.id)!;
      expect(entry.coverUrl).toBe(`/covers/${topic.id.toLowerCase()}.webp`);
      const publicEntry = toPublicFeedEntry(entry);
      expect(publicEntry.reviewStatus).toBe("reviewed");
      expect(JSON.stringify(publicEntry)).not.toMatch(/"(?:isTrue|reveal|sourceIds|rewriteOptions|aiFacts|aiLimitations|eraReview)"/);
      const page = await PostPage({ params: Promise.resolve({ id: topic.id }) });
      expect(page.props.children.props.topicIds).toHaveLength(22);
      for (const answer of [true, false]) {
        const response = await verdict(request({ topicId: topic.id, answer }));
        const result = await response.json();
        expect(response.status).toBe(200);
        expect(result.isCorrect).toBe(answer === topic.isTrue);
        expect(result.reveal).toEqual(topic.reveal);
        expect(result.sources.map(({ id }: { id: string }) => id)).toEqual(topic.sourceIds);
        expect(result.sources.every(({ status }: { status: string }) => status === "reviewed")).toBe(true);
        expect(result.rewriteOptions.filter(({ isBest }: { isBest: boolean }) => isBest)).toHaveLength(1);
      }
      expect((await ask(request({ topicId: topic.id, question: "本题依据是什么？" }))).status).toBe(503);
      const messages = buildAskMessages(topic, getSourcesForTopic(topic), mode === "preview", "本题范围是什么？");
      const context = JSON.parse(messages[1].content.split("\n")[1]);
      expect(context.reviewStatus).toBe("reviewed");
      expect(context.preview).toBe(mode === "preview");
      expect(context.aiLimitations).toEqual(topic.aiLimitations);
      expect(context.sources.map(({ id }: { id: string }) => id)).toEqual(topic.sourceIds);
      expect(context.sources.every(({ status }: { status: string }) => status === "reviewed")).toBe(true);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("复用卷三来源、卷二新增条目；全部原文逐字保留核查记录字形", () => {
    const h14 = candidates[1];
    expect(h14.sourceIds).toEqual(["S-H02-01", "S-H14-01"]);
    expect(sourceIndex.filter(({ url, locator }) => url === "https://zh.wikisource.org/wiki/東京夢華錄/卷三" && locator === "卷三·马行街铺席")).toHaveLength(1);
    const source = (id: string) => sourceIndex.find((source) => source.id === id)!;
    expect(source("S-H02-01").supports).toContain("夜市直至三更盡，才五更又復開張。如要鬧去處，通曉不絕。尋常四梢遠靜去處，夜市亦有燋酸豏、猪胰、胡餅……");
    expect(source("S-H14-01").supports).toContain("謂之雜嚼，直至三更");
    expect(source("S-H13-01").supports).toContain("秦兵马俑彩绘是由底层生漆和颜料层构成的");
    expect(source("S-H13-02").supports).toContain("1分钟后，生漆层的两端明显起翘，4分钟后，大部分起翘");
    expect(source("S-H13-03").supports).toContain("出土后１５秒就开始变化，４分钟内就完全脱水、起翘、剥落");
    expect(source("S-H13-04").supports).toContain("彩绘是制作时最后一个步骤，俑上涂层生漆作底，再在上面敷彩");
    for (const topic of candidates) {
      for (const fact of topic.aiFacts) expect(topic.sourceIds).toContain(fact.match(/^\[([^\]]+)\]/)?.[1]);
      expect(topic.reviewBy).toBe("Giotto"); expect(topic.reviewedAt).toBe("2026-10-30T09:53:00-07:00");
      expect(topic.eraReview).toEqual({ status: "reviewed", reviewer: "Giotto", reviewedAt: "2026-10-30T09:53:00-07:00" });
      for (const source of getSourcesForTopic(topic)) expect(source).toMatchObject({ status: "reviewed", verifiedBy: "Giotto", verifiedAt: "2026-10-30T09:53:00-07:00" });
      const copy = JSON.stringify(topic.reveal);
      if (topic.id === "H13") for (const word of ["埋藏老化", "失水", "每尊", "现代复原彩图", "世界最早"]) expect(copy).toContain(word);
      else for (const word of ["据《东京梦华录》追记", "南宋初", "部分街市", "所有店铺", "才五更", "如要鬧去處"]) expect(copy).toContain(word);
      expect(JSON.stringify(topic.aiLimitations)).not.toContain("待 Giotto 审核");
      const bytes = readFileSync(`public${topic.coverUrl}`);
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
    }
    expect(getAllFeedEntries()).toHaveLength(52);
  });
});
