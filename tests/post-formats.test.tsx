import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostExperience } from "@/components/post/PostExperience";
import { PostFormat } from "@/components/post/formats";
import { toPublicTopic } from "@/lib/public-topic";
import { getAllTopics } from "@/lib/topics";
import { PROGRESS_KEY } from "@/lib/progress";
import { compactCount, postRelativeTime } from "@/lib/social-display";
import { generateMetadata } from "@/app/post/[id]/page";

const topics = getAllTopics();
const poll = toPublicTopic(topics.find(({ id }) => id === "H12")!);
const pollKey = "ahsd:poll:v1:H12";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("按 format 选择帖子模板", () => {
  it.each(topics)("$id 页面 metadata 使用无井号的原题标题", async (topic) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: topic.id }) });
    expect(metadata.title).toBe(topic.title);
    expect(metadata.title).not.toMatch(/^#|#$/);
  });

  it.each(topics)("$id 渲染对应模板、唯一标题/正文、统计与原判题入口", (topic) => {
    const { container } = render(<PostExperience topic={toPublicTopic(topic)} topicIds={topics.map((topic) => topic.id)} />);
    expect(screen.queryByRole("navigation", { name: "面包屑" })).toBeNull();
    expect(container.querySelector("article")?.getAttribute("data-format")).toBe(topic.module === "trending" ? "news" : topic.format ?? "post");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(topic.title);
    expect(screen.getByText(topic.body, { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("互动统计").textContent).toContain(compactCount(topic.simulatedLikes));
    const article = container.querySelector("article")!;
    expect([...article.children].map((node) => node.getAttribute("data-post-section"))).toEqual([topic.module === "trending" ? "masthead" : "author", "format", "title", "body", "cover", "stats"]);
    expect(article.querySelectorAll(".author-row")).toHaveLength(topic.module === "discover" ? 1 : 0);
    expect(article.querySelectorAll("h1")).toHaveLength(1);
    expect(article.querySelectorAll(".post-cover")).toHaveLength(1);
    expect(article.querySelectorAll(".social-stats")).toHaveLength(1);
    expect(article.querySelector('[data-post-section="format"]')!.textContent?.trim()).toBeTruthy();
    expect(article.querySelector('[data-post-section="body"]')!.textContent).toContain(topic.body);
    expect(article.querySelector('[data-post-section="body"]')!.querySelector(".post-cover")).toBeNull();
    if (topic.module === "discover") {
      const author = article.querySelector(".author-row")!;
      expect(article.firstElementChild!.contains(author)).toBe(true);
      expect(author.querySelector(".author-handle")!.textContent).toBe(topic.author.handle);
      expect(author.querySelector(".author-badge")!.textContent).toBe("作者");
      expect(author.textContent).toContain(postRelativeTime(topic.rank));
    } else {
      expect(article.querySelector(".news-masthead")!.textContent).toContain("热点快讯");
      expect(article.querySelector(".author-handle")).toBeNull();
    }
    const stats = screen.getByLabelText("互动统计");
    expect([...stats.querySelectorAll("dt")].map((node) => node.textContent)).toEqual(["回复", "转发", "点赞", "浏览"]);
    expect([...stats.querySelectorAll("dd")].map((node) => node.getAttribute("aria-label"))).toEqual([topic.simulatedComments, topic.simulatedReposts, topic.simulatedLikes, topic.simulatedViews].map((count) => count.toLocaleString("zh-CN")));
    expect(stats.querySelectorAll("svg")).toHaveLength(4);
    expect(stats.querySelector('button, a, [role="button"], [tabindex], [onclick]')).toBeNull();
    const comment = container.querySelector("#post-comments > li")!;
    expect(comment.querySelector(".author-row")!.textContent).toContain(topic.comments[0].author);
    expect(comment.querySelector(".author-handle")).toBeNull();
    expect(article.compareDocumentPosition(comment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(comment.querySelectorAll("dl svg")).toHaveLength(4);
    expect(comment.querySelectorAll("[data-reply-id]")).toHaveLength(topic.module === "discover" ? 3 : 0);
    if (topic.module === "discover") {
      for (const reply of topic.comments[0].replies!) {
        const node = comment.querySelector(`[data-reply-id="${reply.id}"]`)!;
        expect(node.getAttribute("data-reply-to")).toBe(reply.replyTo);
        expect(node.parentElement!.parentElement!.getAttribute("data-reply-id")).toBe(reply.replyTo === topic.comments[0].id ? null : reply.replyTo);
        expect(node.querySelector(":scope > .author-row .author-badge")?.textContent).toBe(reply.author === topic.author.name ? "作者" : undefined);
      }
    }
    expect(comment.querySelector('button, a, [role="button"], [tabindex]')).toBeNull();
    expect(screen.getByRole("heading", { name: "这条主张，你信吗？" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交判断" })).toBeTruthy();
    const briefing = screen.getByRole("complementary", { name: "页内公告与守则" });
    expect(briefing.compareDocumentPosition(container.querySelector(".task-panel")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: /← 返回.*继续围观/ }).getAttribute("href")).toBe(`/${topic.module}`);
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

describe("本次页面直觉投票与判题隔离", () => {
  it.each(["same", "different"])("投 %s 后显示倾向并锁定，本次选择不存本机，重进可重新投票", (choice) => {
    localStorage.setItem(PROGRESS_KEY, '{"existing":"unchanged"}');
    const before = localStorage.getItem(PROGRESS_KEY);
    const { unmount } = render(<PostFormat topic={poll} />);
    expect(screen.queryByText("少数倾向")).toBeNull();
    expect(screen.queryByText("多数倾向")).toBeNull();
    const section = screen.getByRole("region", { name: "直觉投票" });
    fireEvent.click(within(section).getByRole("button", { name: choice === "same" ? "直觉：同一部书" : "直觉：两部书" }));
    expect(screen.getByText("少数倾向")).toBeTruthy();
    expect(screen.getByText("多数倾向")).toBeTruthy();
    expect(section.textContent).not.toMatch(/\d+%/);
    expect(localStorage.getItem(pollKey)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
    for (const button of within(section).getAllByRole("button")) expect(button).toHaveProperty("disabled", true);
    unmount();
    render(<PostFormat topic={poll} />);
    expect(screen.queryByRole("button", { pressed: true })).toBeNull();
    expect(screen.queryByText("少数倾向")).toBeNull();
    expect(screen.queryByText("多数倾向")).toBeNull();
    expect(screen.getAllByRole("button").every((button) => !button.hasAttribute("disabled"))).toBe(true);
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
  });

  it.each([false, true])("主动投票滚动并聚焦原判题区，减少动态效果=%s；重进清空且不跳转", (reducedMotion) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reducedMotion }));
    const props = { topic: poll, topicIds: topics.map(({ id }) => id) };
    const { unmount } = render(<PostExperience {...props} />);
    const heading = screen.getByRole("heading", { name: "这条主张，你信吗？" });
    const panel = heading.closest<HTMLElement>(".task-panel")!;
    const scroll = vi.fn();
    panel.scrollIntoView = scroll;
    fireEvent.click(screen.getByRole("button", { name: "直觉：两部书" }));
    expect(document.activeElement).toBe(heading);
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    unmount();
    const initialFocus = document.activeElement;
    render(<PostExperience {...props} />);
    expect(screen.queryByText("多数倾向")).toBeNull();
    expect(document.activeElement).toBe(initialFocus);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it.each(["same", "different", "garbage", "null", '"same"'])("忽略旧版有效/损坏投票记录 %s，不删除或恢复旧状态", (stored) => {
    localStorage.setItem(pollKey, stored);
    render(<PostFormat topic={poll} />);
    expect(screen.queryByText("少数倾向")).toBeNull();
    expect(screen.getByRole("button", { name: "直觉：同一部书" })).toHaveProperty("disabled", false);
    expect(localStorage.getItem(pollKey)).toBe(stored);
  });

  it("存储读取或写入失败时仍可投票且不发网络请求", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    render(<PostFormat topic={poll} />);
    fireEvent.click(screen.getByRole("button", { name: "直觉：两部书" }));
    expect(screen.getByText("多数倾向")).toBeTruthy();
    expect(screen.queryByText(/本机存储不可用/)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
