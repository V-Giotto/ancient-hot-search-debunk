import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MePage from "@/app/me/page";
import { CollectionProgress } from "@/components/progress/CollectionProgress";
import { StickerWall } from "@/components/stickers/StickerWall";
import { PROGRESS_KEY, saveProgress } from "@/lib/progress";
import { getSticker } from "@/lib/stickers";
import { getAllTopics } from "@/lib/topics";

const topics = getAllTopics();
const stickers = topics.map((topic) => getSticker(topic.id));

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("贴纸墙与本机进度展示", () => {
  it("全题库锁定态不泄题，无可点击帖子；传给客户端的徽记仅有中性主题元数据", () => {
    vi.stubEnv("CONTENT_MODE", "preview");
    const page = MePage();
    const tabs = page.props.children.props.children[3].props.children;
    expect(tabs.props.stickers).toEqual(stickers);
    expect(tabs.props.firstTopicId).toBe(topics.find(({ rank }) => rank === 1)!.id);
    for (const topic of tabs.props.topics) expect(Object.keys(topic).sort()).toEqual(["id", "module", "title"]);
    for (const sticker of stickers) expect(Object.keys(sticker).sort()).toEqual(["id", "mark", "name"]);
    const { container } = render(<StickerWall stickers={tabs.props.stickers} firstTopicId={tabs.props.firstTopicId} />);
    const wall = screen.getByRole("list", { name: "贴纸收藏" });
    expect(within(wall).getAllByRole("listitem")).toHaveLength(topics.length);
    expect(within(wall).getAllByText("未解锁 · 提交判断后收集")).toHaveLength(topics.length);
    expect(within(wall).queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe(`已查证 0/${topics.length}`);
    expect(screen.getByRole("link", { name: "从热榜第 1 条开始" }).getAttribute("href")).toBe(`/post/${topics.find(({ rank }) => rank === 1)!.id}`);
    for (const topic of topics) {
      expect(container.textContent).not.toContain(topic.reveal.correctedClaim);
      expect(container.innerHTML).not.toContain(topic.reveal.shortExplanation);
      for (const option of topic.rewriteOptions) expect(container.textContent).not.toContain(option.text);
    }
    expect(container.textContent).not.toMatch(/谣言退散|查证属实|核心主张为[真假]/);
    expect(container.textContent).not.toMatch(/艺术创作|非史料|虚构|架空|模拟/);
  });

  it("同页保存后更新，已解锁可回帖，重温与改写不增加数量", () => {
    render(<><CollectionProgress topicIds={topics.map(({ id }) => id)} /><StickerWall stickers={stickers} /></>);
    act(() => { saveProgress({ topicId: "H03", selectedAnswer: false, revealed: true }); });
    const wall = screen.getByRole("list", { name: "贴纸收藏" });
    expect(within(wall).getAllByRole("link")).toHaveLength(1);
    const link = within(wall).getByRole("link", { name: /饭局手记/ });
    expect(link.getAttribute("href")).toBe("/post/H03");
    expect(link.textContent).toContain("已收藏 · 重新挑战");
    act(() => { saveProgress({ topicId: "H03", selectedAnswer: false, revealed: true, selectedRewriteOptionId: "C" }); });
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toEqual([`已查证 1/${topics.length}`, `已查证 1/${topics.length}`]);
    cleanup();
    render(<StickerWall stickers={stickers} firstTopicId={topics.find(({ rank }) => rank === 1)!.id} />);
    expect(screen.getByRole("status").textContent).toBe(`已查证 1/${topics.length}`);
    expect(screen.queryByRole("link", { name: "从热榜第 1 条开始" })).toBeNull();
    expect(within(screen.getByRole("list", { name: "贴纸收藏" })).getAllByRole("link")).toHaveLength(1);
  });

  it("跨页存储事件和清除事件同步解锁/归零，重新聚焦时也检查清除", () => {
    render(<StickerWall stickers={stickers} firstTopicId={topics.find(({ rank }) => rank === 1)!.id} />);
    act(() => {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ H03: { topicId: "H03", selectedAnswer: true, revealed: true } }));
      window.dispatchEvent(new StorageEvent("storage", { key: PROGRESS_KEY }));
    });
    expect(screen.getByRole("status").textContent).toBe(`已查证 1/${topics.length}`);
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(screen.getByRole("status").textContent).toBe(`已查证 0/${topics.length}`);
    expect(screen.getByRole("link", { name: "从热榜第 1 条开始" })).toBeTruthy();
    act(() => { saveProgress({ topicId: "H03", selectedAnswer: false, revealed: true }); });
    act(() => { localStorage.clear(); window.dispatchEvent(new Event("focus")); });
    expect(screen.getByRole("status").textContent).toBe(`已查证 0/${topics.length}`);
  });

  it("存储不可用时显示说明、保留锁定态", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("blocked"); });
    render(<StickerWall stickers={stickers} />);
    expect(screen.getByText(/本机存储不可用/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(`已查证 0/${topics.length}`);
    expect(within(screen.getByRole("list", { name: "贴纸收藏" })).queryAllByRole("link")).toHaveLength(0);
  });

  it("题库增加时总数动态变化，空题库进度条仍有效", () => {
    const { rerender } = render(<StickerWall stickers={[...stickers, getSticker("H15")]} />);
    expect(screen.getByRole("status").textContent).toBe(`已查证 0/${topics.length + 1}`);
    expect(screen.getByRole("list", { name: "贴纸收藏" }).children).toHaveLength(topics.length + 1);
    rerender(<StickerWall stickers={[]} />);
    expect(screen.getByRole("status").textContent).toBe("已查证 0/0");
    expect(screen.getByRole("progressbar").getAttribute("max")).toBe("1");
  });
});
