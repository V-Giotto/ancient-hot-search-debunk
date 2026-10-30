import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostExperience } from "@/components/post/PostExperience";
import { MyFavorites } from "@/components/me/MyFavorites";
import { FriendChat } from "@/components/friends/FriendChat";
import { getAllFeedEntries, getFeedEntryById, getSameTopicEntries, toPublicFeedEntry } from "@/lib/feed";
import { getAllTopics, getSourcesForTopic } from "@/lib/topics";
import { readCollectionProgress, PROGRESS_KEY } from "@/lib/progress";
import { readSocialState } from "@/lib/social-storage";
import { getAllFriends, toFriendProfile } from "@/lib/friends";
import { parseChatStorage, chatStorageKey } from "@/lib/chat-storage";
import constraints from "./fixtures/display-constraints.json";
import { getAskPrompts } from "@/lib/ask-prompts";

const topics = getAllTopics();
const topicIds = topics.map(({ id }) => id);
const entries = getAllFeedEntries();
const publicEntry = (id: string) => toPublicFeedEntry(getFeedEntryById(id)!);
const friends = getAllFriends().map(toFriendProfile);

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLElement.prototype, "focus");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const topic = topics.find(({ id }) => id === body.topicId)!;
    return Response.json({ isTrue: topic.isTrue, isCorrect: topic.isTrue === body.answer, reveal: topic.reveal, sources: getSourcesForTopic(topic), rewriteOptions: topic.rewriteOptions });
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function submit(answer = false) {
  fireEvent.click(screen.getByRole("radio", { name: answer ? "是真的" : "是假的" }));
  fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
  return screen.findByRole("region", { name: "本题贴纸" });
}

describe("按题收集、按帖互动", () => {
  it("T01/P01/P02/H01 反复作答只收集 H01 一次；进度恢复而帖子每次重玩", async () => {
    let saved: string | null = null;
    for (const [index, id] of ["T01", "P01", "P02", "H01"].entries()) {
      const view = render(<PostExperience topic={publicEntry(id)} topicIds={topicIds} relatedEntries={getSameTopicEntries(getFeedEntryById(id)!)} />);
      expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
      expect(screen.queryByRole("region", { name: "本题贴纸" })).toBeNull();
      expect((await submit(index % 2 === 1)).textContent).toContain(index ? "诗友手记 · 已收藏" : "获得贴纸：诗友手记 · 已查证 1/12");
      expect(readCollectionProgress(topicIds).completedIds).toEqual(["H01"]);
      if (index === 0) saved = localStorage.getItem(PROGRESS_KEY);
      else expect(localStorage.getItem(PROGRESS_KEY)).toBe(saved);
      const request = vi.mocked(fetch).mock.calls.at(-1)!;
      expect(JSON.parse(String(request[1]?.body)).topicId).toBe("H01");
      view.unmount();
    }
    expect(Object.keys(JSON.parse(saved!))).toEqual(["H01"]);
  });

  it.each(["T05", "P10"])("$0 从 topicId 取真假、改写、来源及 AI 请求；模板取条目", async (id) => {
    const entry = getFeedEntryById(id)!;
    const topic = topics.find(({ id }) => id === entry.topicId)!;
    render(<PostExperience topic={publicEntry(id)} topicIds={topicIds} />);
    expect(document.querySelector("article")?.getAttribute("data-module")).toBe(entry.module);
    expect(screen.getByText(topic.claim)).toBeTruthy();
    await submit(topic.isTrue);
    expect(within(screen.getByLabelText("预设问题")).getAllByRole("button").map((button) => button.textContent)).toEqual(getAskPrompts(topic.id));
    expect(screen.getAllByText(topic.reveal.correctedClaim).length).toBeGreaterThan(0);
    for (const source of getSourcesForTopic(topic)) expect(document.querySelector(`a[href="${source.url}"]`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${topic.rewriteOptions.find(({ isBest }) => isBest)!.id} `) }));
    expect(screen.getByText("改写正确，这样说更准确。")).toBeTruthy();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ answer: "仅用于组件验证", citedSourceIds: [], grounded: false }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "还想知道一点" } });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    await screen.findByText("仅用于组件验证");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)![1]?.body)).topicId).toBe(topic.id);
  });

  it("同题条目的点赞收藏独立，刷新恢复；我的收藏使用条目原帖链接", () => {
    let view = render(<PostExperience topic={publicEntry("T01")} topicIds={topicIds} />);
    for (const label of ["点赞", "收藏"]) fireEvent.click(screen.getByRole("button", { name: label }));
    view.unmount();
    view = render(<PostExperience topic={publicEntry("P01")} topicIds={topicIds} />);
    expect(screen.getByRole("button", { name: "点赞" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    view.unmount();
    view = render(<PostExperience topic={publicEntry("T01")} topicIds={topicIds} />);
    expect(screen.getByRole("button", { name: "点赞" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "收藏" }).getAttribute("aria-pressed")).toBe("true");
    view.unmount();
    render(<MyFavorites topics={entries.map(({ id, title, module }) => ({ id, title, module }))} />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/post/T01", "/post/P01"]);
    expect(readSocialState()).toEqual({ T01: { liked: true, saved: true }, P01: { liked: false, saved: true } });
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("分享新条目保留内容链接；好友请求只带历史 topicId，卡片刷新不丢失", async () => {
    const topic = publicEntry("T01");
    const view = render(<PostExperience topic={topic} topicIds={topicIds} friends={friends} />);
    fireEvent.click(screen.getByRole("button", { name: /^转发/ }));
    expect(screen.getByLabelText("把这条见闻分享给朋友")).toHaveProperty("value", `${window.location.origin}/post/T01`);
    expect(screen.getByRole("link", { name: "转发给李白" }).getAttribute("href")).toContain("sharedTopicId=T01");
    view.unmount();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "offline" }, { status: 503 }));
    render(<FriendChat friend={friends[0]} incomingShare={{ token: "new-entry-share", topic: { id: topic.id, topicId: topic.topicId, module: topic.module, title: topic.title } }} />);
    await screen.findByText("好友暂时不在线");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)![1]?.body)).sharedTopicId).toBe("H01");
    const stored = parseChatStorage(localStorage.getItem(chatStorageKey(friends[0].id)));
    expect(stored[0]).toMatchObject({ role: "share", topic: { id: "T01", topicId: "H01" } });
    expect(screen.getByRole("link", { name: `分享卡片：${topic.title}` }).getAttribute("href")).toBe("/post/T01");
  });
});

describe("新增内容的渲染边界", () => {
  it.each(entries.filter(({ id }) => /^[TP]/.test(id)))("$id 讨论可展开、同话题链接准确、初始 UI 无答案或禁用标签", (entry) => {
    const related = getSameTopicEntries(entry);
    const { container } = render(<PostExperience topic={toPublicFeedEntry(entry)} topicIds={topicIds} relatedEntries={related} />);
    fireEvent.click(screen.getByRole("button", { name: /展开更多评论/ }));
    expect(container.querySelectorAll("#post-comments > li")).toHaveLength(6);
    const recommendations = screen.getByRole("list", { name: "同话题推荐" });
    expect(within(recommendations).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(related.map(({ id }) => `/post/${id}`));
    for (const word of [...constraints.hiddenUiWords, ...constraints.falseInteractionWords]) expect(container.textContent).not.toContain(word);
    expect(container.textContent).not.toMatch(new RegExp(constraints.verdictPattern));
    expect(container.querySelector("textarea")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
