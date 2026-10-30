import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOCIAL_KEY, favoriteTopics, interactionCount, parseSocialStorage, readSocialState, writeSocialState } from "@/lib/social-storage";
import { CHAT_STORAGE_MAX_ENTRIES, chatStorageKey, parseChatStorage, readChatHistory, saveChatHistory } from "@/lib/chat-storage";
import { MyFavorites } from "@/components/me/MyFavorites";
import { PostActions } from "@/components/post/PostActions";
import { FriendChat } from "@/components/friends/FriendChat";
import { getAllFriends, toFriendProfile } from "@/lib/friends";
import { getAllTopics } from "@/lib/topics";
import { toPublicTopic } from "@/lib/public-topic";
const topics = getAllTopics();
const topic = toPublicTopic(topics[0]);
const friends = getAllFriends().map(toFriendProfile);
const libai = friends.find((friend) => friend.id === "libai")!;
const share = { token: "share-1", topic: { id: topic.id, title: topic.title, module: topic.module } };
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { localStorage.clear(); fetchMock.mockReset().mockResolvedValue(Response.json({ error: "offline" }, { status: 503 })); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("点赞收藏版本存储", () => {
  it("v0 与无版本格式迁移、逐项修复、坏 JSON 和未来版本安全降级", () => {
    const expected = { H01: { liked: true, saved: true }, H05: { liked: false, saved: false } };
    for (const value of [{ H01: { liked: true, bookmarked: true }, H05: { liked: "true" }, bad: {} }, { version: 0, topics: { H01: { liked: true, bookmarked: true }, H05: {} } }]) {
      const state = parseSocialStorage(JSON.stringify(value));
      expect(state).toEqual(expected);
      expect(writeSocialState(state)).toBe(true);
      expect(JSON.parse(localStorage.getItem(SOCIAL_KEY)!)).toEqual({ version: 1, topics: expected });
      expect(readSocialState()).toEqual(expected);
    }
    for (const raw of ["{", "null", "[]", '{"version":99,"topics":{"H01":{"liked":true}}}']) expect(parseSocialStorage(raw)).toEqual({});
  });
  it("计数严格只加一，取消恢复基础数，收藏仅返回已知帖", () => {
    expect(interactionCount(35600, true)).toBe(35601);
    expect(interactionCount(35600, false)).toBe(35600);
    expect(favoriteTopics(topics, { H01: { liked: false, saved: true }, H999: { liked: true, saved: true } }).map(({ id }) => id)).toEqual(["H01"]);
  });
  it.each(["H01", "H05"])("%s 点赞收藏刷新后恢复，计数可朗读；不改判题记录", (id) => {
    const t = toPublicTopic(topics.find((entry) => entry.id === id)!);
    localStorage.setItem("ahsd:progress:v1", "untouched");
    const view = render(<PostActions topic={t} />);
    for (const name of ["点赞", "收藏"]) fireEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name: "点赞" }).textContent).toContain("+1");
    expect(document.getElementById(screen.getByRole("button", { name: "点赞" }).getAttribute("aria-describedby")!)?.textContent).toBe(`${(t.simulatedLikes + 1).toLocaleString("zh-CN")} 人点赞`);
    view.unmount(); render(<PostActions topic={t} />);
    for (const name of ["点赞", "收藏"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(button); expect(button.getAttribute("aria-pressed")).toBe("false");
    }
    expect(localStorage.getItem("ahsd:progress:v1")).toBe("untouched");
  });
  it("存储不可用仍可切换", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("blocked"); });
    render(<PostActions topic={topic} />);
    const button = screen.getByRole("button", { name: "点赞" });
    fireEvent.click(button); expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button); expect(button.getAttribute("aria-pressed")).toBe("false");
  });
  it("我的收藏含标题、模块与原帖链接，取消后显示去热搜榜的空态", () => {
    writeSocialState({ H01: { liked: true, saved: true }, H05: { liked: false, saved: true } });
    render(<MyFavorites topics={topics} />);
    const list = screen.getByRole("list", { name: "我的收藏" });
    expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/post/H01", "/post/H05"]);
    expect(list.textContent).toContain(topic.title);
    expect(list.textContent).toContain("热搜"); expect(list.textContent).toContain("发现");
    render(<PostActions topic={topic} />);
    fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/post/H05"]);
    expect(screen.queryByRole("link", { name: new RegExp(topic.title.replace(/[？?]/g, ".")) })).toBeNull();
  });
  it("无收藏有空态和榜单入口", () => {
    render(<MyFavorites topics={topics} />);
    expect(screen.getByRole("link", { name: "去热搜榜看看" }).getAttribute("href")).toBe("/trending");
    expect(screen.queryByRole("list")).toBeNull();
  });
  it("弹层数据好友、aria-modal、焦点循环和关闭返回触发器", () => {
    render(<PostActions topic={topic} friends={friends} />);
    const trigger = screen.getByRole("button", { name: "转发" }); trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "转发给好友" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    for (const friend of friends) expect(within(dialog).getByRole("link", { name: `转发给${friend.name}` }).getAttribute("href")).toContain(`sharedTopicId=${topic.id}`);
    const close = screen.getByRole("button", { name: "关闭转发弹层" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    fireEvent.keyDown(dialog, { key: "Tab" }); expect(document.activeElement).toBe(close);
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("dialog")); expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("好友分享卡片与历史", () => {
  it("历史版本迁移、隔离、条数上限、损坏条目容错", () => {
    const entries = Array.from({ length: 80 }, (_, i) => ({ role: "user" as const, content: `消息${i}` }));
    saveChatHistory("libai", entries);
    expect(readChatHistory("libai")).toHaveLength(CHAT_STORAGE_MAX_ENTRIES);
    expect(readChatHistory("dufu")).toEqual([]);
    for (const value of [entries, { version: 0, entries }]) expect(parseChatStorage(JSON.stringify(value))).toHaveLength(CHAT_STORAGE_MAX_ENTRIES);
    expect(parseChatStorage('{"version":1,"entries":[{}, {"role":"user","content":"你好"}]}')).toEqual([{ role: "user", content: "你好" }]);
    expect(parseChatStorage("{")).toEqual([]);
    expect(parseChatStorage('{"version":99,"entries":[]}')).toEqual([]);
  });
  it("分享卡片无 key 仍显示、带 sharedTopicId，刷新不重复插卡或请求，清空后持久为空", async () => {
    const view = render(<FriendChat friend={libai} incomingShare={share} />);
    expect(screen.getByRole("link", { name: `分享卡片：${topic.title}` }).getAttribute("href")).toBe(`/post/${topic.id}`);
    await screen.findByText("好友暂时不在线");
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({ sharedTopicId: topic.id, friendId: "libai" });
    expect(readChatHistory("libai")[0]).toMatchObject({ role: "share", status: "offline" });
    view.unmount(); render(<FriendChat friend={libai} incomingShare={share} />);
    expect(screen.getAllByRole("link", { name: /分享卡片/ })).toHaveLength(1); expect(fetchMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "清空对话" }));
    expect(readChatHistory("libai")).toEqual([]); expect(screen.queryByRole("link", { name: /分享卡片/ })).toBeNull();
    expect(JSON.parse(localStorage.getItem(chatStorageKey("libai"))!).version).toBe(1);
  });
  it("mock 好友回复与后续话题上下文持久化；普通历史不包含分享元数据", async () => {
    fetchMock.mockImplementation(async () => Response.json({ reply: "此事吾不敢妄言。" }));
    const view = render(<FriendChat friend={libai} incomingShare={share} />);
    await screen.findByText("此事吾不敢妄言。");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "再说两句" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await waitFor(() => expect(readChatHistory("libai")).toHaveLength(4));
    const body = JSON.parse(fetchMock.mock.calls[1][1]!.body as string);
    expect(body.sharedTopicId).toBe(topic.id); expect(body.history).toEqual([{ role: "assistant", content: "此事吾不敢妄言。" }]);
    view.unmount(); render(<FriendChat friend={libai} />);
    expect(screen.getByRole("link", { name: /分享卡片/ })).toBeTruthy(); expect(screen.getAllByText("此事吾不敢妄言。")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
