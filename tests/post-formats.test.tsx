import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostExperience } from "@/components/post/PostExperience";
import { PostFormat } from "@/components/post/formats";
import { toPublicTopic } from "@/lib/public-topic";
import { getAllTopics, getSourcesForTopic } from "@/lib/topics";
import { PROGRESS_KEY, readCollectionProgress } from "@/lib/progress";
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

  it.each(topics)("$id 按模块渲染独立版式，并保留原判题入口", (topic) => {
    const { container } = render(<PostExperience topic={toPublicTopic(topic)} topicIds={topics.map(({ id }) => id)} />);
    const article = container.querySelector("article")!;
    const news = topic.module === "trending";
    expect(article.getAttribute("data-format")).toBe(news ? "news" : topic.format ?? "post");
    expect(article.getAttribute("data-module")).toBe(topic.module);
    expect(within(article).getByRole("heading", { level: 1 }).textContent).toBe(topic.title);
    expect(article.querySelector(".post-body")!.textContent).toBe(topic.body);
    expect(article.querySelectorAll("h1")).toHaveLength(1);
    expect(article.querySelectorAll(".post-cover")).toHaveLength(1);
    const eraChip = within(article).getByLabelText(`历史年代：${topic.era.label}`);
    expect(eraChip.textContent).toBe(topic.era.label);
    expect(eraChip.closest('[data-post-section]')?.getAttribute("data-post-section")).toBe(news ? "byline" : "format");
    expect(article.querySelector('[data-post-section="body"] .post-cover')).toBeNull();
    if (news) {
      expect([...article.children].map((node) => node.getAttribute("data-post-section"))).toEqual(["masthead", "title", "byline", "lead", "cover", "body", "related", "actions"]);
      expect(article.querySelector(".news-masthead")!.textContent).toContain("热点报道");
      expect(article.querySelector(".news-byline")!.textContent).toContain(topic.news!.outlet);
      expect(article.querySelector("time")!.dateTime).toBe(topic.news!.publishedAt);
      expect(article.querySelector(".news-lead")!.textContent).toBe(topic.news!.lead);
      expect(within(article).getByRole("region", { name: "相关报道" }).querySelectorAll("li")).toHaveLength(2);
      expect(article.querySelector(".news-related")!.textContent).toContain(topic.news!.related[0]);
      expect(article.querySelector(".social-stats, .author-row, .reply-thread, .comments-panel, .follow-button")).toBeNull();
      expect(article.textContent).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u20e3\ufe0f]/u);
      expect(article.textContent).not.toMatch(/家人们|谁懂啊|顶流|塑料友情|小板凳|在线蹲/);
    } else {
      expect([...article.children].map((node) => node.getAttribute("data-post-section"))).toEqual(["author", "format", "title", "cover", "body", "actions"]);
      const author = article.querySelector(".author-row")!;
      expect(article.firstElementChild!.contains(author)).toBe(true);
      expect(author.querySelector(".author-handle")!.textContent).toBe(topic.author.handle);
      expect(author.querySelector(".author-badge")!.textContent).toBe("作者");
      expect(author.textContent).toContain(postRelativeTime(topic.rank));
      expect(article.querySelector('.post-invitation [data-pixel-icon="reply"]')?.getAttribute("aria-hidden")).toBe("true");
      expect(within(article).getByRole("button", { name: `关注${topic.author.name}` })).toBeTruthy();
      const actions = within(article).getByRole("group", { name: "帖子互动" });
      expect(within(actions).getByRole("button", { name: "点赞" }).textContent).toContain(compactCount(topic.simulatedLikes));
      expect(within(actions).getByRole("button", { name: "收藏" })).toBeTruthy();
      expect(within(actions).getByRole("button", { name: /^转发/ })).toBeTruthy();
    }
    expect(screen.getByRole("region", { name: news ? "读者评论" : "评论区" })).toBeTruthy();
    const comment = container.querySelector("#post-comments > li")!;
    expect(comment.querySelector(".author-row")!.textContent).toContain(topic.comments[0].author);
    expect(comment.querySelectorAll("dl svg")).toHaveLength(4);
    expect(comment.querySelectorAll("[data-reply-id]")).toHaveLength(topic.comments[0].replies?.length ?? 0);
    for (const reply of topic.comments[0].replies!) {
      const node = comment.querySelector(`[data-reply-id="${reply.id}"]`)!;
      expect(node.getAttribute("data-reply-to")).toBe(reply.replyTo);
      expect(node.parentElement!.parentElement!.getAttribute("data-reply-id")).toBe(reply.replyTo === topic.comments[0].id ? null : reply.replyTo);
      expect(node.querySelector(":scope > .author-row .author-badge")?.textContent).toBe(reply.author === topic.author.name ? "作者" : undefined);
    }
    expect(container.querySelectorAll("#post-comments > li")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /展开更多评论/ }));
    expect(container.querySelectorAll("#post-comments > li")).toHaveLength(topic.comments.length);
    expect(screen.getByRole("heading", { name: "这条主张，你信吗？" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(container.querySelector(".mobile-briefing")).toBeNull();
    expect(container.textContent).not.toMatch(/辟谣局公告|今天的吃瓜守则/);
    expect(screen.getByRole("link", { name: /返回.*继续/ }).getAttribute("href")).toBe(`/${topic.module}`);
    expect(container.textContent).not.toContain(topic.reveal.correctedClaim);
    expect(container.textContent).not.toMatch(/架空|模拟|艺术创作|非史料/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("发现的手作配图、聊天转发与投票模板继续可用", () => {
    const { rerender } = render(<PostFormat topic={toPublicTopic(topics[9])} />);
    expect(screen.getByLabelText("朋友圈配图格")).toBeTruthy();
    rerender(<PostFormat topic={toPublicTopic(topics[10])} />);
    expect(screen.getByLabelText("群聊转发")).toBeTruthy();
    rerender(<PostFormat topic={poll} />);
    expect(screen.getByRole("region", { name: "直觉投票" })).toBeTruthy();
  });

  it("关注只保存本地作者状态，重进恢复并可取消，不请求网络或改动进度", () => {
    const topic = toPublicTopic(topics.find(({ id }) => id === "H05")!);
    localStorage.setItem(PROGRESS_KEY, '{"existing":"unchanged"}');
    const props = { topic, topicIds: topics.map(({ id }) => id) };
    const { unmount } = render(<PostExperience {...props} />);
    const follow = screen.getByRole("button", { name: `关注${topic.author.name}` });
    expect(follow.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(follow);
    expect(follow.textContent).toBe("已关注");
    expect(localStorage.getItem(`ahsd:following:v1:${topic.author.handle}`)).toBe("true");
    unmount();
    render(<PostExperience {...props} />);
    const restored = screen.getByRole("button", { name: `关注${topic.author.name}` });
    expect(restored.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(restored);
    expect(restored.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(PROGRESS_KEY)).toBe('{"existing":"unchanged"}');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("存储受限时关注仍可来回切换", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<PostFormat topic={toPublicTopic(topics[4])} />);
    const follow = screen.getByRole("button", { name: /^关注/ });
    fireEvent.click(follow);
    expect(follow.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(follow);
    expect(follow.getAttribute("aria-pressed")).toBe("false");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("点赞与收藏独立切换，转发实际复制本页链接，不影响判题与贴纸", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<PostExperience topic={toPublicTopic(topics[4])} topicIds={topics.map(({ id }) => id)} />);
    for (const label of ["点赞", "收藏"]) {
      const action = screen.getByRole("button", { name: label });
      fireEvent.click(action);
      expect(action.getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(action);
      expect(action.getAttribute("aria-pressed")).toBe("false");
    }
    fireEvent.click(screen.getByRole("button", { name: /^转发/ }));
    expect(screen.getByLabelText("把这条见闻分享给朋友")).toHaveProperty("value", `${window.location.origin}/post/H05`);
    fireEvent.click(screen.getByRole("button", { name: "复制链接" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "链接已复制" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/post/H05`);
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("复制受限时展示可手动复制的链接与明确反馈", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<PostFormat topic={toPublicTopic(topics[4])} />);
    fireEvent.click(screen.getByRole("button", { name: /^转发/ }));
    fireEvent.click(screen.getByRole("button", { name: "复制链接" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "复制未完成，可选中上方链接手动复制。");
    expect(screen.getByLabelText("把这条见闻分享给朋友")).toHaveProperty("value", `${window.location.origin}/post/H05`);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("两模块共用判题与贴纸闭环", () => {
  it.each(["H01", "H05"])("%s 可判题、揭晓、再玩一次；重答不重复获得贴纸", async (id) => {
    const topic = topics.find((topic) => topic.id === id)!;
    const ids = topics.map(({ id }) => id);
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ isTrue: topic.isTrue, isCorrect: true, reveal: topic.reveal, sources: getSourcesForTopic(topic), rewriteOptions: topic.rewriteOptions }) } as Response);
    try {
      render(<PostExperience topic={toPublicTopic(topic)} topicIds={ids} />);
      fireEvent.click(screen.getByRole("radio", { name: topic.isTrue ? "是真的" : "是假的" }));
      fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
      const sticker = await screen.findByRole("region", { name: "本题贴纸" });
      expect(sticker.textContent).toContain("获得贴纸：");
      expect(screen.getByRole("button", { name: "生成查证卡" })).toBeTruthy();
      expect(readCollectionProgress(ids).completedIds).toEqual([id]);
      fireEvent.click(screen.getByRole("button", { name: "再玩一次" }));
      expect(screen.queryByRole("region", { name: "本题贴纸" })).toBeNull();
      expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "这条主张，你信吗？" }));
      expect(readCollectionProgress(ids).completedIds).toEqual([id]);
      fireEvent.click(screen.getByRole("radio", { name: topic.isTrue ? "是真的" : "是假的" }));
      fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
      expect((await screen.findByRole("region", { name: "本题贴纸" })).textContent).toContain("已收藏");
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: topic.reveal.verdictHeadline })));
      expect(screen.queryByText(/获得贴纸：/)).toBeNull();
      expect(readCollectionProgress(ids).completedIds).toEqual([id]);
      expect(fetch).toHaveBeenCalledTimes(2);
      for (const [url] of vi.mocked(fetch).mock.calls) expect(url).toBe("/api/verdict");
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
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
    expect(section.textContent).not.toMatch(/虚构|架空|模拟|预置展示|预设倾向/);
    expect(localStorage.getItem(pollKey)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
    for (const button of within(section).getAllByRole("button")) expect(button).toHaveProperty("disabled", true);
    unmount();
    render(<PostFormat topic={poll} />);
    expect(screen.queryByRole("region", { name: "直觉投票" })?.querySelector('[aria-pressed="true"]')).toBeNull();
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
