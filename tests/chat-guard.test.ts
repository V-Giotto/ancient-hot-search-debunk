// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findChatOutputViolations, findUnsupportedChatQuotes, getChatSafeReply, normalizeChatSelfReferences } from "@/lib/chat-guard";
import { getFriendById, getFriendSources } from "@/lib/friends";
import { makeSource } from "./fixtures";
import { quoteKnowledge } from "./knowledge-fixtures";

const friend = { ...getFriendById("libai")!, knowledge: [quoteKnowledge("憐君如弟兄"), quoteKnowledge("春日忆李白", "title-one"), quoteKnowledge("全唐詩", "title-two")] };
const sources = getFriendSources(friend);

describe("好友引用必须逐字出自 reviewed 且获准的 exactQuote", () => {
  it.each([["“", "”"], ["‘", "’"], ["「", "」"], ["『", "』"], ['"', '"'], ["'", "'"]])("校验 %s%s 内的原话，不自动简繁转换", (open, close) => {
    expect(findUnsupportedChatQuotes(`杜甫写过${open}憐君如弟兄${close}。`, friend, sources)).toEqual([]);
    expect(findUnsupportedChatQuotes(`杜甫写过${open}怜君如弟兄${close}。`, friend, sources)).toEqual(["怜君如弟兄"]);
  });
  it("书名也须有独立exactQuote权限，不能从来源标题自动获得", () => {
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
  ])("允许第一人称、谈论对方及已审书名：%s %s", (id, reply) => {
    expect(findChatOutputViolations(reply, getFriendById(id)!, sources)).toEqual({ unsupportedQuotes: [], personaFragments: [], missingEraMarker: false, mixedSelfReferences: false });
  });
  it("引号不能掩盖自我旁白或元话语，两类违规一并报告", () => {
    expect(findChatOutputViolations("资料里‘李白说不存在的诗句’。", friend, sources)).toEqual({
      unsupportedQuotes: ["李白说不存在的诗句"], personaFragments: ["资料里"], missingEraMarker: false, mixedSelfReferences: false,
    });
    expect(findChatOutputViolations("‘来源’", friend, sources).personaFragments).toEqual(["来源"]);
  });
  it.each(["libai", "dufu"])("%s 兜底以配置自称表达存疑，无元话语、署名或引文", (id) => {
    const current = getFriendById(id)!;
    const reply = getChatSafeReply(current);
    expect(reply).toContain(current.persona.selfReference[0]);
    expect(reply).toContain("记不真切");
    expect(reply).not.toMatch(/[“”‘’「」『』《》"']/);
    expect(findChatOutputViolations(reply, current, sources)).toEqual({ unsupportedQuotes: [], personaFragments: [], missingEraMarker: false, mixedSelfReferences: false });
  });
});

describe("整条回复的我／吾自称一致性", () => {
  it.each([
    ["libai", "吾不敢妄言，吾也愿听听。我记不真切。", "吾不敢妄言，吾也愿听听。吾记不真切。"],
    ["libai", "我不敢妄言，我也愿听听。吾记不真切。", "我不敢妄言，我也愿听听。我记不真切。"],
    ["dufu", "甫记不真切，我不敢说，我也愿听听。吾不敢断言。", "甫记不真切，我不敢说，我也愿听听。我不敢断言。"],
  ])("%s 安全替换少数方自称，再检查整条回复", (id, reply, expected) => {
    const current = getFriendById(id)!;
    expect(findChatOutputViolations(reply, current, sources).mixedSelfReferences).toBe(true);
    expect(normalizeChatSelfReferences(reply, current)).toBe(expected);
    expect(findChatOutputViolations(expected, current, sources).mixedSelfReferences).toBe(false);
  });
  it.each([
    "吾不敢说，我也记不清。", // 数量相同
    "吾不敢说，吾也记不清。我们再聊聊。", // 不造出吾们
    "吾不敢说，吾也记不清。自我不必放大。", // 不改词义
    "吾不敢说，吾也记不清。无我不等于执念。", // 不把无我改成无吾
    "吾不敢说，吾也记不清。问我不如问你。", // 宾语不能确认为主语
    "吾不敢说，吾也记不清，吾愿听听。我不知，何谓无我不必放大？", // 不做部分替换
    "吾不敢说，吾也记不清。‘我记不真切’。", // 不改引文
    "吾不敢说，吾也记不清。《我也不知》。", // 不改书名
    "吾不敢说，吾也记不清。‘我不敢说。", // 不完整引号
  ])("不能安全规范化时保留原文并报告混用：%s", (reply) => {
    expect(normalizeChatSelfReferences(reply, friend)).toBe(reply);
    expect(findChatOutputViolations(reply, friend, sources).mixedSelfReferences).toBe(true);
  });
  it.each(["甫记不真切，我也不敢说。", "甫记不真切，吾也不敢说。", "吾不敢说。", "我记不清。", "换个话头可好？"])("只有一种或没有我／吾时不报混用：%s", (reply) => {
    const dufu = getFriendById("dufu")!;
    expect(normalizeChatSelfReferences(reply, dufu)).toBe(reply);
    expect(findChatOutputViolations(reply, dufu, sources).mixedSelfReferences).toBe(false);
  });
  it("不把多数方换成好友未配置的自称", () => {
    const reply = "吾不敢说，吾也记不清。我记不真切。";
    expect(normalizeChatSelfReferences(reply, getFriendById("dufu")!)).toBe(reply);
  });
});

describe("晚代耳闻标记与统一校验", () => {
  const laterEra = { label: "北宋", order: 5 } as const;
  it("春秋战国不要求唐代好友带耳闻标记", () => {
    expect(findChatOutputViolations("此事吾不敢妄言。", friend, sources, [], { label: "春秋战国", order: 1 }).missingEraMarker).toBe(false);
  });
  it.each(["听说", "听闻", "耳闻", "据说", "后世", "身后"])("晚代回复接受标记：%s", (marker) => {
    expect(findChatOutputViolations(`${marker}此事，吾不敢多说。`, friend, sources, [], laterEra).missingEraMarker).toBe(false);
  });
  it("同轮报告引文、元话语和时代违规，不能相互掩盖", () => {
    expect(findChatOutputViolations("资料里‘不存在的引文’。", friend, sources, [], laterEra)).toEqual({
      unsupportedQuotes: ["不存在的引文"], personaFragments: ["资料里"], missingEraMarker: true, mixedSelfReferences: false,
    });
    expect(findChatOutputViolations("听说资料里‘不存在的引文’。", friend, sources, [], laterEra)).toEqual({
      unsupportedQuotes: ["不存在的引文"], personaFragments: ["资料里"], missingEraMarker: false, mixedSelfReferences: false,
    });
  });
  it.each(["libai", "dufu"])("%s 的晚代兜底以配置自称且通过所有输出检查", (friendId) => {
    const current = getFriendById(friendId)!;
    const reply = getChatSafeReply(current, laterEra);
    expect(reply).toBe(`${current.persona.selfReference[0]}身后之事，只是耳闻，不敢多说。`);
    expect(findChatOutputViolations(reply, current, sources, [], laterEra)).toEqual({
      unsupportedQuotes: [], personaFragments: [], missingEraMarker: false, mixedSelfReferences: false,
    });
    expect(getChatSafeReply(current, current.era)).toBe(getChatSafeReply(current));
    expect(getChatSafeReply(current, { label: "战国", order: 2 })).toBe(getChatSafeReply(current));
  });
});
