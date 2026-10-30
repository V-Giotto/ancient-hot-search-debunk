import { Activity } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FriendChat } from "@/components/friends/FriendChat";
import FriendsPage from "@/app/friends/page";
import { getFriendById, toFriendProfile } from "@/lib/friends";

vi.mock("next/navigation", () => ({ usePathname: () => "/friends/libai" }));
const friend = toFriendProfile(getFriendById("libai")!);
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { localStorage.clear(); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset().mockResolvedValue(Response.json({ reply: "此事吾记不真切了，换个话头可好？" })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function write(value: string) { fireEvent.change(screen.getByRole("textbox", { name: "写给李白" }), { target: { value } }); }
function send() { fireEvent.click(screen.getByRole("button", { name: "发送消息" })); }
const transcript = () => screen.getByRole("log", { name: "与李白的对话" });

describe("好友列表与即时对话", () => {
  it("由数据渲染列表和原创 SVG，并正确链接到好友", () => {
    render(FriendsPage());
    const list = screen.getByRole("list", { name: "好友列表" });
    expect(within(list).getByRole("link", { name: "与李白对话" }).getAttribute("href")).toBe("/friends/libai");
    expect(within(list).getByRole("link", { name: "与杜甫对话" }).getAttribute("href")).toBe("/friends/dufu");
    expect(list.querySelectorAll("svg.friend-avatar")).toHaveLength(2);
    expect(list.querySelectorAll("img, image, script")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("首次只有开场白、一行角色说明与禁用的空输入发送按钮", () => {
    render(<FriendChat friend={friend} />);
    expect(within(transcript()).getByText(friend.greeting)).toBeTruthy();
    expect(screen.getByText("这是角色扮演，史实以给定资料为准。")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).maxLength).toBe(200);
    expect((screen.getByRole("button", { name: "发送消息" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("发送中显示自己的气泡、阻止重复发送，成功后好友在左侧且输入清空", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<FriendChat friend={friend} />); write("  你好  "); send(); send();
    expect(screen.getByRole("status").textContent).toContain("正在回信");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(transcript().querySelector(".chat-message-user .chat-bubble")?.textContent).toBe("你好");
    expect(within(transcript()).getAllByText("我", { exact: true })).toHaveLength(1);
    resolve(Response.json({ reply: "此事吾记不真切了，换个话头可好？" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    expect(transcript().querySelectorAll(".chat-message-assistant")).toHaveLength(2);
    expect(within(transcript()).getAllByText("我", { exact: true })).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ friendId: "libai", message: "你好", history: [] });
  });
  it.each([503, 429, 502, 504])("%s 友好错误，保留输入；重试后无重复消息", async (status) => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "不得展示的上游原文" }, { status }));
    render(<FriendChat friend={friend} />); write("你好"); send();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).not.toContain("上游原文");
    if (status === 503) expect(within(screen.getByRole("alert")).getByText("好友暂时不在线")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("你好");
    fireEvent.click(screen.getByRole("button", { name: "重试发送" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(transcript().querySelectorAll(".chat-message-user")).toHaveLength(1);
  });
  it("网络失败与非法成功响应均能恢复重试", async () => {
    fetchMock.mockRejectedValueOnce(new Error("private exception"));
    fetchMock.mockResolvedValueOnce(Response.json({ reply: "" }));
    render(<FriendChat friend={friend} />); write("你好"); send();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(document.body.textContent).not.toContain("private exception");
    fireEvent.click(screen.getByRole("button", { name: "重试发送" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByRole("alert")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("你好");
  });
  it("超过 6 轮时只发送最近 12 条历史，不发送开场白", async () => {
    fetchMock.mockImplementation(async () => Response.json({ reply: "此事吾不敢妄言。" }));
    render(<FriendChat friend={friend} />);
    for (let index = 0; index < 8; index++) {
      write(`消息${index}`); send();
      await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(""));
    }
    const history = JSON.parse(fetchMock.mock.calls[7][1]!.body as string).history;
    expect(history).toHaveLength(12);
    expect(history[0]).toEqual({ role: "user", content: "消息1" });
    expect(history.at(-1)).toEqual({ role: "assistant", content: "此事吾不敢妄言。" });
    expect(JSON.stringify(history)).not.toContain(friend.greeting);
  });
  it("卸载后取消请求；重新打开不恢复历史与草稿", async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const view = render(<FriendChat friend={friend} />); write("待发送"); send();
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {});
    render(<FriendChat friend={friend} />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    expect(transcript().querySelectorAll("li")).toHaveLength(1);
  });
  it("路由暂存中断等待后重新显示，可以继续发送", async () => {
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const view = render(<Activity mode="visible"><FriendChat friend={friend} /></Activity>);
    write("待发送"); send();
    view.rerender(<Activity mode="hidden"><FriendChat friend={friend} /></Activity>);
    await act(async () => {});
    view.rerender(<Activity mode="visible"><FriendChat friend={friend} /></Activity>);
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("button", { name: "发送消息" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
