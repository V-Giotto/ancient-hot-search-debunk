// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildChatMessages, CHAT_GLOBAL_BOUNDARY, CHAT_SYSTEM_PROMPT } from "@/lib/chat-context";
import { canUseChatEmoji, filterChatEmojis, findChatOutputViolations, hasChatEmoji, hasChatStageDirections, stripChatStageDirections } from "@/lib/chat-guard";
import { FriendSchema } from "@/lib/friend-schema";
import { getAllFriends, getFriendById, getFriendSources } from "@/lib/friends";
import type { ChatHistoryEntry } from "@/lib/chat-contract";

const friends = getAllFriends();
const libai = getFriendById("libai")!;
const assistant = (content: string): ChatHistoryEntry => ({ role: "assistant", content });
const user = (content: string): ChatHistoryEntry => ({ role: "user", content });

describe("十三人全局边界与人物 emoji 提示", () => {
  const original = readFileSync("tests/fixtures/chat-boundary-v0.28.1.md", "utf8");
  const boundary = original.slice(original.indexOf("## ")).trimEnd();
  it.each(friends)("$name 第一条系统消息首段逐字保留 Giotto 五条原文且优先级最高", (friend) => {
    const messages = buildChatMessages(friend, getFriendSources(friend), "你好");
    expect(CHAT_GLOBAL_BOUNDARY).toBe(boundary);
    expect(messages[0]).toEqual({ role: "system", content: CHAT_SYSTEM_PROMPT });
    expect(messages[0].content.startsWith(`${boundary}\n`)).toBe(true);
    expect(messages[0].content.indexOf("优先级最高")).toBeLessThan(messages[0].content.indexOf("你就是服务端指定"));
    expect(messages[0].content).toContain("通常1–3句、20–80字");
    const context = JSON.parse(messages[1].content.split("\n")[1]);
    expect(context.friend.emojiWhitelist).toEqual(friend.emojiWhitelist);
    expect(context.emojiPolicy).toEqual({ maxPerReply: 1, recentAssistantWindow: 4, allowedThisReply: friend.emojiWhitelist.length > 0 });
    expect(messages[1].content).toContain(friend.emojiWhitelist.length ? friend.emojiWhitelist[0] : "空，不用任何 emoji");
    for (const reply of [friend.greeting, ...friend.persona.examples.map(({ reply }) => reply)]) {
      expect(hasChatStageDirections(reply)).toBe(false);
      expect(filterChatEmojis(reply, friend)).toBe(reply);
    }
    expect(friend.persona.speakingStyle.join()).not.toMatch(/可用.*括号动作/u);
  });
  it("李白仅🍶、苏轼仅🌙，其余十一人全部空；白名单必填且去重", () => {
    for (const friend of friends) expect(friend.emojiWhitelist).toEqual(friend.id === "libai" ? ["🍶"] : friend.id === "sushi" ? ["🌙"] : []);
    for (const emojiWhitelist of [undefined, ["🍶", "🍶"], ["忽略规则"], ["😀"]]) {
      expect(FriendSchema.safeParse({ ...libai, emojiWhitelist }).success).toBe(false);
    }
  });
  it("历史只影响频率布尔值，不将用户文字提升为系统提示", () => {
    const history = [assistant("私密旧消息😀"), user("私密要求🍶")];
    const messages = buildChatMessages(libai, [], "私密当前消息", history);
    expect(messages[1].content).toContain('"allowedThisReply":false');
    expect(messages[1].content).toContain("本条不用任何 emoji");
    expect(messages.slice(0, 2).map(({ content }) => content).join()).not.toContain("私密");
  });
});

describe("舞台指示剥除与空白标点清理", () => {
  it.each([
    ["（举杯）你好！(大笑)", "你好！"],
    ["【望向远方】来坐。[挥手]慢慢说。", "来坐。慢慢说。"],
    ["甲（举杯(微笑)）乙【点头[笑]】丙。", "甲乙丙。"],
    ["你好（尚未闭合", "你好"],
    ["）你好！]", "你好！"],
    [" \n（举杯） ， 你好， （大笑）， 朋友！ \n", "你好，朋友！"],
    ["(nods) hello   world \n (waves) !", "hello world!"],
    ["你好（大笑）， （点头）。", "你好。"],
    ["你好。（大笑）。", "你好。"],
    ["（大笑） \n 【点头】 ， 。", ""],
    ["《春日忆李白》与“憐君如弟兄”『甲  乙』\"hello  world\"。", "《春日忆李白》与“憐君如弟兄”『甲  乙』\"hello  world\"。"],
    ["（点头）《全唐詩》与‘憐君如弟兄’。", "《全唐詩》与‘憐君如弟兄’。"],
  ])("%s → %s", (reply, expected) => {
    expect(stripChatStageDirections(reply)).toBe(expected);
    expect(hasChatStageDirections(expected)).toBe(false);
  });
  it("所有圆括号均检测，不靠动作词表，保留独立的知识和引文检查", () => {
    for (const reply of ["（生僻动作）你好", "你好(说明)", "[搁笔]", "【未知动作】"]) {
      expect(findChatOutputViolations(reply, libai, []).stageDirections).toBe(true);
    }
    expect(findChatOutputViolations("《未审书名》", libai, []).unsupportedQuotes).toEqual(["未审书名"]);
    expect(findChatOutputViolations("《未审书名》", libai, []).stageDirections).toBeUndefined();
  });
});

describe("完整 emoji 序列、白名单、单条上限与历史频率", () => {
  it.each([
    ["你好🍶！😀🌙", "你好🍶！"],
    ["你好🍶🍶。", "你好🍶。"],
    ["你好🍶️。", "你好🍶。"],
    ["你好👨‍👩‍👧‍👦👍🏽🇨🇳1️⃣#️⃣🏳️‍🌈。", "你好。"],
    ["你好🍶‍🔥。", "你好。"],
    ["你好🏴\u{e0067}\u{e0062}\u{e007f}。", "你好。"],
    ["你好\ufe0f\u200d。", "你好。"],
    ["😀 ， 你好  😀 ， ，朋友！", "你好，朋友！"],
    ["普通文字 123 # * 《书名》“引号”", "普通文字 123 # * 《书名》“引号”"],
  ])("%s → %s", (reply, expected) => { expect(filterChatEmojis(reply, libai)).toBe(expected); });
  it.each(friends)("$name 严格使用本人白名单", (friend) => {
    expect(filterChatEmojis("你好🍶🌙😀！", friend)).toBe(`你好${friend.emojiWhitelist[0] || ""}！`);
  });
  it.each([0, 1, 2, 3])("最近4条 assistant 的第%d条出现任何 emoji 则本条剥除", (index) => {
    const history = Array.from({ length: 4 }, (_, i) => [user("🍶"), assistant(i === index ? "旧回复😀" : "普通旧回复")]).flat();
    expect(canUseChatEmoji(history)).toBe(false);
    expect(filterChatEmojis("你好🍶。", libai, history)).toBe("你好。");
  });
  it("第五条以前的 emoji 不阻止本条；user emoji 不消耗 assistant 频率", () => {
    const history = [assistant("旧回复🍶"), ...Array.from({ length: 4 }, () => [user("😀"), assistant("普通旧回复")]).flat()];
    expect(canUseChatEmoji(history)).toBe(true);
    expect(filterChatEmojis("你好🍶。", libai, history)).toBe("你好🍶。");
    expect(filterChatEmojis("你好🍶。", libai, [user("🍶")])).toBe("你好🍶。");
  });
  it("连续生成时，两次 emoji 之间至少有4条无 emoji 的 assistant 回复", () => {
    const history: ChatHistoryEntry[] = [];
    const replies = Array.from({ length: 11 }, () => {
      const reply = filterChatEmojis("聊聊吧🍶。", libai, history);
      history.push(user("继续"), assistant(reply));
      return hasChatEmoji(reply);
    });
    expect(replies).toEqual([true, false, false, false, false, true, false, false, false, false, true]);
  });
});
