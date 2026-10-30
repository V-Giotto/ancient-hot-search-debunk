import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostExperience } from "@/components/post/PostExperience";
import { PostFormat } from "@/components/post/formats";
import { toPublicTopic } from "@/lib/public-topic";
import { getAllTopics } from "@/lib/topics";
import { PROGRESS_KEY } from "@/lib/progress";
import { authorHandle, compactCount, postRelativeTime } from "@/lib/social-display";

const topics = getAllTopics();
const poll = toPublicTopic(topics.find(({ id }) => id === "H12")!);
const pollKey = "ahsd:poll:v1:H12";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("按 format 选择帖子模板", () => {
  it.each(topics)("$id 渲染对应模板、唯一标题/正文、统计与原判题入口", (topic) => {
    const { container } = render(<PostExperience topic={toPublicTopic(topic)} />);
    expect(container.querySelector("article")?.getAttribute("data-format")).toBe(topic.format ?? "post");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(topic.title);
    expect(screen.getByText(topic.body, { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("互动统计").textContent).toContain(compactCount(topic.simulatedLikes));
    const article = container.querySelector("article")!;
    const author = article.querySelector(".author-row")!;
    expect(article.firstElementChild!.contains(author)).toBe(true);
    expect(author.textContent).toContain(authorHandle(topic.author.name));
    expect(author.textContent).toContain(postRelativeTime(topic.rank));
    const stats = screen.getByLabelText("互动统计");
    expect([...stats.querySelectorAll("dt")].map((node) => node.textContent)).toEqual(["回复", "转发", "点赞", "浏览"]);
    expect([...stats.querySelectorAll("dd")].map((node) => node.getAttribute("aria-label"))).toEqual([topic.simulatedComments, topic.simulatedReposts, topic.simulatedLikes, topic.simulatedViews].map((count) => count.toLocaleString("zh-CN")));
    expect(stats.querySelectorAll("svg")).toHaveLength(4);
    expect(stats.querySelector('button, a, [role="button"], [tabindex], [onclick]')).toBeNull();
    const comment = container.querySelector("#post-comments > li")!;
    expect(comment.querySelector(".author-row")!.textContent).toContain(authorHandle(topic.comments[0].author));
    expect(comment.querySelectorAll("dl svg")).toHaveLength(4);
    expect(comment.querySelector('button, a, [role="button"], [tabindex]')).toBeNull();
    expect(screen.getByRole("heading", { name: "这条主张，你信吗？" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交判断" })).toBeTruthy();
    expect(container.querySelectorAll("#post-comments")).toHaveLength(1);
    expect(container.querySelectorAll("#post-comments > li")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /展开更多评论/ }));
    expect(container.querySelectorAll("#post-comments > li")).toHaveLength(8);
    expect(container.textContent).not.toContain(topic.reveal.correctedClaim);
    expect(container.textContent).not.toMatch(/架空|模拟|艺术创作|非史料/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("朋友圈有配图格与点赞区，聊天有转发气泡，快讯有播报栏", () => {
    const { rerender } = render(<PostFormat topic={toPublicTopic(topics[8])} />);
    expect(screen.getByText("街巷突发播报")).toBeTruthy();
    rerender(<PostFormat topic={toPublicTopic(topics[9])} />);
    expect(screen.getByLabelText("朋友圈配图格")).toBeTruthy();
    expect(screen.getByText("♡ 点赞区 · 手作围观中", { exact: true })).toBeTruthy();
    rerender(<PostFormat topic={toPublicTopic(topics[10])} />);
    expect(screen.getByLabelText("群聊转发")).toBeTruthy();
    expect(screen.getByText("转发消息 · 待核对")).toBeTruthy();
  });
});

describe("本机直觉投票与判题隔离", () => {
  it.each(["same", "different"])("投 %s 后才显示固定比例，锁定选择，刷新恢复且不改变判题进度", (choice) => {
    localStorage.setItem(PROGRESS_KEY, '{"existing":"unchanged"}');
    const before = localStorage.getItem(PROGRESS_KEY);
    const { unmount } = render(<PostFormat topic={poll} />);
    expect(screen.queryByText("42%")).toBeNull();
    expect(screen.queryByText("58%")).toBeNull();
    const section = screen.getByRole("region", { name: "直觉投票" });
    fireEvent.click(within(section).getByRole("button", { name: choice === "same" ? "直觉：同一部书" : "直觉：两部书" }));
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText("58%")).toBeTruthy();
    expect(localStorage.getItem(pollKey)).toBe(choice);
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
    for (const button of within(section).getAllByRole("button")) expect(button).toHaveProperty("disabled", true);
    unmount();
    render(<PostFormat topic={poll} />);
    expect(screen.getByRole("button", { pressed: true }).textContent).toContain(choice === "same" ? "同一部书" : "两部书");
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText("58%")).toBeTruthy();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
  });

  it.each(["garbage", "null", '"same"'])("忽略损坏/非法存储 %s", (stored) => {
    localStorage.setItem(pollKey, stored);
    render(<PostFormat topic={poll} />);
    expect(screen.queryByText("42%")).toBeNull();
    expect(screen.getByRole("button", { name: "直觉：同一部书" })).toHaveProperty("disabled", false);
  });

  it("存储读取或写入失败时仍可投票且不发网络请求", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    render(<PostFormat topic={poll} />);
    fireEvent.click(screen.getByRole("button", { name: "直觉：两部书" }));
    expect(screen.getByText("58%")).toBeTruthy();
    expect(screen.getByText(/本机存储不可用/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
