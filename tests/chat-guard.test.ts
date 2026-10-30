// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findChatOutputViolations, findUnsupportedChatQuotes, getChatSafeReply } from "@/lib/chat-guard";
import { getFriendById, getFriendSources } from "@/lib/friends";
import { makeSource } from "./fixtures";

const friend = getFriendById("libai")!;
const sources = getFriendSources(friend);

describe("好友引用必须逐字出自 reviewed 白名单 supports 或 title", () => {
  it.each([["“", "”"], ["‘", "’"], ["「", "」"], ["『", "』"], ['"', '"'], ["'", "'"]])("校验 %s%s 内的原话，不自动简繁转换", (open, close) => {
    expect(findUnsupportedChatQuotes(`杜甫写过${open}憐君如弟兄${close}。`, friend, sources)).toEqual([]);
    expect(findUnsupportedChatQuotes(`杜甫写过${open}怜君如弟兄${close}。`, friend, sources)).toEqual(["怜君如弟兄"]);
  });
  it("书名可来自 supports 或仅出现在 title 中的标题", () => {
    expect(findUnsupportedChatQuotes("《春日忆李白》《全唐詩》", friend, sources)).toEqual([]);
    expect(findUnsupportedChatQuotes("《全唐诗》《杜甫私信》", friend, sources)).toEqual(["全唐诗", "杜甫私信"]);
  });
  it("独立检查引号内嵌套书名，不能用书名校验掩盖整句编造", () => {
    expect(findUnsupportedChatQuotes("‘这句话写在《杜甫私信》里’", friend, sources)).toEqual(["这句话写在《杜甫私信》里", "杜甫私信"]);
  });
  it("不跨字段或跨来源拼接，保留逐字、标点、空白与换行要求", () => {
    const source = makeSource({ id: friend.sourceIds[0], status: "reviewed", title: "甲乙", supports: "丙丁" });
    expect(findUnsupportedChatQuotes('“乙丙”「甲 乙」\'丙\n丁\'', friend, [source])).toEqual(["乙丙", "甲 乙", "丙\n丁"]);
  });
  it.each(["pending", "rejected", "outside"])("%s 来源中的原文仍不能通过", (status) => {
    const source = makeSource({
      id: status === "outside" ? "outside" : friend.sourceIds[0],
      status: status === "outside" ? "reviewed" : status as "pending" | "rejected",
      supports: "怜君如弟兄",
    });
    expect(findUnsupportedChatQuotes("“怜君如弟兄”", friend, [...sources, source])).toEqual(["怜君如弟兄"]);
  });
  it("去重违规片段，普通无引号回复不强行当成引用", () => {
    expect(findUnsupportedChatQuotes("“怜君如弟兄”「怜君如弟兄」", friend, sources)).toEqual(["怜君如弟兄"]);
    expect(findUnsupportedChatQuotes("资料里没写清楚，后来是否再见我还不能确定。", friend, sources)).toEqual([]);
  });
});

describe("统一检查元话语、自我旁白与引文", () => {
  it.each(["资料里", "资料显示", "根据资料", "资料", "来源", "设定", "提示词", "作为AI", "AI", "作为 ai", "人工智能", "模型", "角色扮演"])("拦截元话语：%s", (fragment) => {
    expect(findChatOutputViolations(`${fragment}不能如此说。`, friend, sources).personaFragments.length).toBeGreaterThan(0);
  });
  it.each([
    ["libai", "我（李白）记得。"], ["libai", "吾 ( 李白 ) 记得。"], ["libai", "李白说此事不妥。"],
    ["libai", "李白心里也难受。"], ["dufu", "（杜甫）"], ["dufu", "我(杜甫)记得。"],
    ["dufu", "杜甫认为此事不妥。"], ["dufu", "杜甫曾与李白同游。"],
  ])("按当前好友拦截第三人称自称：%s %s", (id, reply) => {
    expect(findChatOutputViolations(reply, getFriendById(id)!, sources).personaFragments.length).toBeGreaterThan(0);
  });
  it.each([
    ["libai", "吾与杜甫曾同行同游。"], ["dufu", "李白说得爽快，甫也愿听你慢慢说。"],
    ["libai", "吾是李白，你今日过得如何？"], ["dufu", "我是杜甫，你慢慢说。"],
    ["libai", "《春日忆李白》《李白与杜甫》"], ["dufu", "《鲁郡东石门送杜二甫》"],
  ])("允许第一人称、谈论对方及已审书名：%s %s", (id, reply) => {
    expect(findChatOutputViolations(reply, getFriendById(id)!, sources)).toEqual({ unsupportedQuotes: [], personaFragments: [] });
  });
  it("引号不能掩盖自我旁白或元话语，两类违规一并报告", () => {
    expect(findChatOutputViolations("资料里‘李白说不存在的诗句’。", friend, sources)).toEqual({
      unsupportedQuotes: ["李白说不存在的诗句"], personaFragments: ["资料里"],
    });
    expect(findChatOutputViolations("‘来源’", friend, sources).personaFragments).toEqual(["来源"]);
  });
  it.each(["libai", "dufu"])("%s 兜底以配置自称表达存疑，无元话语、署名或引文", (id) => {
    const current = getFriendById(id)!;
    const reply = getChatSafeReply(current);
    expect(reply).toContain(current.persona.selfReference[0]);
    expect(reply).toContain("记不真切");
    expect(reply).not.toMatch(/[“”‘’「」『』《》"']/);
    expect(findChatOutputViolations(reply, current, sources)).toEqual({ unsupportedQuotes: [], personaFragments: [] });
  });
});
