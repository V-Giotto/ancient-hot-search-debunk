import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import TrendingPage from "@/app/trending/page";
import { TrendingBoard } from "@/components/trending/TrendingBoard";
import { saveProgress } from "@/lib/progress";
import { getAllTopics } from "@/lib/topics";
import { trendingTag, trendingTagClass } from "@/lib/trending-tag";

const topics = getAllTopics();
const categories = [...new Set(topics.map((topic) => topic.category))];
const ranking = () => screen.getByRole("list", { name: "热搜排行" });

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("移动端热榜", () => {
  it("只将榜单所需的七个题面字段传到客户端", () => {
    const board = TrendingPage().props.children;
    expect(board.props.topics).toHaveLength(topics.length);
    for (const topic of board.props.topics) {
      expect(Object.keys(topic).sort()).toEqual(["category", "coverAlt", "coverUrl", "id", "rank", "simulatedHeat", "title"]);
    }
  });

  it("展示项目横幅、万热度、不同名次颜色类和沿用的三种标签", () => {
    render(TrendingPage());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("古代热搜辟谣局");
    expect(screen.getByText("让古人上热搜，让你来辟谣。")).toBeTruthy();
    expect(screen.getByText("128.6 万热度")).toBeTruthy();
    expect(screen.getByText("50 万热度")).toBeTruthy();
    const rows = within(ranking()).getAllByRole("listitem");
    expect(rows).toHaveLength(topics.length);
    rows.forEach((row, index) => {
      const topic = topics[index];
      expect(row.getAttribute("value")).toBe(String(topic.rank));
      expect(within(row).getByRole("link").getAttribute("href")).toBe(`/post/${topic.id}`);
      const rank = within(row).getByTestId("trending-rank");
      expect(rank.textContent).toBe(String(topic.rank));
      expect(rank.classList.contains(`trending-rank-${topic.rank <= 3 ? topic.rank : "rest"}`)).toBe(true);
      const tag = within(row).getByTestId("trending-tag");
      const expected = trendingTag(topic.rank, topics.length);
      expect(tag.textContent).toBe(expected);
      for (const className of trendingTagClass[expected].split(" ")) expect(tag.classList.contains(className)).toBe(true);
      expect(within(row).getByRole("img").getAttribute("src")).toBe(topic.coverUrl);
    });
  });

  it("从 category 去重生成分类，逐类筛选，返回全部；进度始终使用完整题库", () => {
    render(TrendingPage());
    const tabs = within(screen.getByRole("tablist", { name: "热榜分类" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["全部", ...categories]);
    act(() => { saveProgress({ topicId: "H03", selectedAnswer: false, revealed: true }); });
    for (const category of categories) {
      const selected = screen.getByRole("tab", { name: category });
      fireEvent.click(selected);
      expect(screen.getByRole("tab", { selected: true })).toBe(selected);
      const panel = screen.getByRole("tabpanel", { name: category });
      expect(selected.getAttribute("aria-controls")).toBe(panel.id);
      expect(panel.getAttribute("aria-labelledby")).toBe(selected.id);
      const expected = topics.filter((topic) => topic.category === category);
      expect(within(ranking()).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(expected.map((topic) => `/post/${topic.id}`));
      expect(within(ranking()).getAllByTestId("trending-rank").map((rank) => rank.textContent)).toEqual(expected.map((topic) => String(topic.rank)));
      expect(within(ranking()).getAllByTestId("trending-tag").map((tag) => tag.textContent)).toEqual(expected.map((topic) => trendingTag(topic.rank, topics.length)));
      expect(screen.getByRole("status").textContent).toBe(`已查证 1/${topics.length}`);
      expect(screen.getByRole("progressbar").getAttribute("max")).toBe(String(topics.length));
      expect(screen.getByRole("link", { name: "贴纸墙 →" }).getAttribute("href")).toBe("/stickers");
    }
    fireEvent.click(tabs[0]);
    expect(within(ranking()).getAllByRole("listitem")).toHaveLength(topics.length);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("全部");
  });

  it("分类支持方向键循环及 Home/End，只有选中项参与 Tab 顺序", () => {
    render(TrendingPage());
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    const move = (key: string, expectedIndex: number) => {
      fireEvent.keyDown(document.activeElement!, { key });
      expect(document.activeElement).toBe(tabs[expectedIndex]);
      expect(screen.getByRole("tab", { selected: true })).toBe(tabs[expectedIndex]);
      expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([tabs[expectedIndex]]);
    };
    move("ArrowRight", 1);
    move("ArrowLeft", 0);
    move("ArrowLeft", tabs.length - 1);
    move("ArrowRight", 0);
    move("End", tabs.length - 1);
    move("Home", 0);
  });

  it("空题库仍展示全部分类、空态与有效进度", () => {
    render(<TrendingBoard topics={[]} />);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("全部");
    expect(screen.getByText("热搜还在准备中")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("已查证 0/0");
    expect(screen.getByRole("progressbar").getAttribute("max")).toBe("1");
  });
});
