import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllTopics, getAvailableTopics, getSourcesForTopic, validateContentSet } from "@/lib/topics";
import { getAvailableFeedEntries, getFeedEntryById, toPublicFeedEntry } from "@/lib/feed";
import { getAllFriends } from "@/lib/friends";
import { buildAskMessages, getAllowedFacts } from "@/lib/ask-context";
import { POST as verdict } from "@/app/api/verdict/route";
import { POST as ask } from "@/app/api/ask/route";
import { VerdictReveal } from "@/components/post/VerdictReveal";
import sourceIndex from "@/data/source-index.json";

const stamp = "2026-10-30T17:28:00-07:00";
const added = getAllTopics().slice(14);
const request = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
const claims = [
  "王莽时期出现的铜卡尺能够证明王莽是现代穿越者。",
  "玄武门之变后，李世民被立为皇太子。",
  "《史记·秦始皇本纪》记载，嫪毐曾矫用秦王御玺及太后玺，调发兵众发动叛乱。",
  "高俅仅凭一次蹴鞠表现，当场被任命为太尉。",
  "《铡美案》中陈世美被包拯处决的故事，是有史料证实的宋代真实案件。",
  "2013年考古发现的墓志为确认上官婉儿墓主身份提供了关键证据。",
  "万历五年，张居正因父丧奏请守制，明神宗下令夺情，使其继续任职。",
  "李建成墓志中谥号“隐”字的位置存在磨改重刻痕迹。",
];
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("H15–H22 Giotto 核心审核与展示边界", () => {
  it("保留H13/H14原内容与审核签名，仅登记展示审核和作者头像，八题编号、命题和5真3假采用审核原文", () => {
    for (const [file, hash] of [["h13", "42808b42bf5105393e4f363427d597c1837b1789e845ec2faa7468a1e30b3e42"], ["h14", "7ededc2eea7c35b3f712c98d3c2cd1cbb0f2915c2f8b6b4e6f6e34010a3eda85"]]) {
      const raw = JSON.parse(readFileSync(`data/topics/${file}.json`, "utf8"));
      for (const comment of raw.comments) {
        delete comment.reviewStatus;
        for (const reply of comment.replies ?? []) delete reply.reviewStatus;
      }
      expect(createHash("sha256").update(JSON.stringify(raw)).digest("hex")).toBe(hash);
    }
    expect(added.map(({ id }) => id)).toEqual(["H15", "H16", "H17", "H18", "H19", "H20", "H21", "H22"]);
    expect(added.map(({ claim }) => claim)).toEqual(claims);
    expect(added.map(({ isTrue }) => isTrue)).toEqual([false, true, true, false, false, true, true, true]);
    expect(added.map(({ module }) => module)).toEqual(["trending", "trending", "trending", "discover", "discover", "trending", "discover", "discover"]);
    expect(() => validateContentSet(getAllTopics(), sourceIndex, { expectedCount: 22 })).not.toThrow();
  });

  it.each(added)("$id 核心与年代已审，feed、改写、AI文案审核独立；事实卡来源全部有效", (topic) => {
    expect(topic).toMatchObject({ reviewStatus: "reviewed", reviewBy: "Giotto", reviewedAt: stamp });
    expect(topic.eraReview).toEqual({ status: "reviewed", reviewer: "Giotto", reviewedAt: stamp });
    const entry = getFeedEntryById(topic.id)!;
    expect(entry.editorialReviewStatus).toBe("pending");
    expect(entry.coverUrl).toBe(`/covers/${topic.id.toLowerCase()}.webp`);
    const sources = getSourcesForTopic(topic);
    for (const source of sources) expect(source).toMatchObject({ status: "reviewed", verifiedBy: "Giotto", verifiedAt: stamp });
    expect(getAllowedFacts(topic.aiFacts, topic.sourceIds)).toEqual(topic.aiFacts);
    const context = JSON.parse(buildAskMessages(topic, sources, false, "本题的边界是什么？")[1].content.split("\n")[1]);
    expect(context.aiLimitations).toEqual(topic.aiLimitations);
    expect(context.sources.map(({ id }: { id: string }) => id)).toEqual(topic.sourceIds);
    expect(topic.rewriteOptions.filter(({ isBest }) => isBest)).toHaveLength(1);
    expect(JSON.stringify(toPublicFeedEntry(entry))).not.toMatch(/"(?:isTrue|reveal|sourceIds|rewriteOptions|aiFacts|aiLimitations|eraReview|editorialReviewStatus)"/);
  });

  it.each(["formal", "preview", "", "invalid"])("%j模式含22题与52帖，新增判题成功；无key不调用AI", async (mode) => {
    vi.stubEnv("CONTENT_MODE", mode); vi.stubEnv("AI_API_KEY", "");
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect(getAvailableTopics()).toHaveLength(22);
    expect(getAvailableFeedEntries()).toHaveLength(52);
    for (const topic of added) {
      for (const answer of [false, true]) {
        const response = await verdict(request({ topicId: topic.id, answer }));
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.isCorrect).toBe(answer === topic.isTrue);
        expect(result.reveal).toEqual(topic.reveal);
        expect(result.sources.map(({ id }: { id: string }) => id)).toEqual(topic.sourceIds);
      }
      expect((await ask(request({ topicId: topic.id, question: "本题的边界是什么？" }))).status).toBe(503);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("备用、失败与不相关链接不进入来源UI或AI白名单，内部记录保留", () => {
    const forbidden = ["sport.gov.cn", "ccs.city", "mct.gov.cn", "ctext.org", "tci.ncl.edu.tw", "fx361", "241454.html", "12106158.htm"];
    const shown = JSON.stringify(added.flatMap(getSourcesForTopic));
    for (const word of forbidden) expect(shown).not.toContain(word);
    const internal = readFileSync("docs/CONTENT_REVIEW.md", "utf8");
    for (const word of forbidden) expect(internal).toContain(word);
    expect(added.find(({ id }) => id === "H19")!.sourceIds).toHaveLength(2);
    expect(shown).toContain("孙红瑀"); expect(shown).toContain("范振平");
    expect(getAllFriends().find(({ id }) => id === "qinshihuang")!.sourceIds).toEqual(["S-H13-01", "S-H13-02", "S-H13-03", "S-H13-04"]);
  });

  it("关键揭晓与时代严格保留Giotto限定，逐字引文与交叉来源存在", () => {
    const topic = (id: string) => added.find((topic) => topic.id === id)!;
    expect(topic("H15").reveal.shortExplanation).toBe("铜卡尺是真实的古代技术器物，结构与现代工具相似，并不构成王莽来自现代的证据。");
    expect(topic("H16").evidenceEra).toBe("五代后晋《旧唐书》（945年成书）");
    expect(getSourcesForTopic(topic("H16")).find(({ id }) => id === "S-H16-02")!.supports).toContain("癸亥，立世民為皇太子。又詔：「自今軍國庶事，無大小悉委太子處決，然後聞奏。」");
    expect(topic("H17").evidenceEra).toBe("西汉《史记》（司马迁著述）");
    expect(topic("H18").reveal.shortExplanation).toBe("南宋王明清《挥麈录》记载，高俅因蹴鞠获得端王赏识，后来逐渐受到重用，并在宋徽宗即位后得到升迁。但这并非“当场升任太尉”，该书相关段落也未直接作出这种记载。");
    expect(topic("H19").reveal.shortExplanation).toBe("《铡美案》属于经过长期演变的戏曲故事，不能作为宋代真实司法案件看待。现有史料没有证实陈世美被包拯处决这一完整情节。");
    expect(topic("H20").evidenceEra).toBe("唐代墓志（记载公元710年安葬），2013年8月出土，9月11日官方消息公开");
    expect(getSourcesForTopic(topic("H20"))[0].url).toBe("https://www.chinanews.com.cn/cul/2013/09-11/5271315.shtml");
    expect(JSON.stringify(topic("H20").reveal)).not.toContain("官方毁墓");
    expect(getSourcesForTopic(topic("H21")).find(({ id }) => id === "S-H21-02")!.supports).toContain("未幾，丁父憂。帝遣司禮中官慰問");
    expect(JSON.stringify(topic("H21").aiFacts)).not.toContain("本人倾向夺情");
    expect(topic("H22").evidenceEra).toContain("2005年出土、2012年追回、2013年移交收藏");
  });

  it("H22月份差异只在关闭的史料争议折叠区，不进入核心揭晓与判定", () => {
    const topic = added[7];
    const { funFact, ...core } = topic.reveal;
    expect(JSON.stringify({ claim: topic.claim, ...core })).not.toMatch(/正月|三月/);
    render(<VerdictReveal result={{ isTrue: true, isCorrect: true, reveal: topic.reveal, rewriteOptions: topic.rewriteOptions, sources: getSourcesForTopic(topic) }} />);
    const details = screen.getByText("史料争议", { exact: true }).closest("details")!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain(funFact);
    expect(details.textContent).toContain("正月"); expect(details.textContent).toContain("三月");
  });
});
