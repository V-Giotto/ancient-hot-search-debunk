// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findUnsupportedChatQuotes } from "@/lib/chat-guard";
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
