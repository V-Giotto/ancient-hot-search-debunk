import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DiscoverPage from "@/app/discover/page";
import { getAllTopics } from "@/lib/topics";
import { DiscoverFeed } from "@/components/discover/DiscoverFeed";

afterEach(cleanup);

describe("发现页", () => {
  it("实际发现页仅有发现题目，无匹配时仍能前往热榜第一条", () => {
    render(DiscoverPage());
    const firstTrending = getAllTopics().find((topic) => topic.module === "trending")!;
    const briefing = screen.getByRole("complementary", { name: "页内公告与守则" });
    expect(briefing.compareDocumentPosition(screen.getByRole("list", { name: "发现话题" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "筛选话题" }), { target: { value: "无匹配的关键词" } });
    expect(screen.getByRole("link", { name: "从热榜第 1 条开始" }).getAttribute("href")).toBe(`/post/${firstTrending.id}`);
  });

  it("筛选无结果时引导到全榜第 1 条，清除后恢复完整列表", () => {
    const topics = getAllTopics().toReversed();
    render(<DiscoverFeed topics={topics} />);
    const input = screen.getByRole("searchbox", { name: "筛选话题" });
    fireEvent.change(input, { target: { value: "无匹配的关键词" } });
    expect(screen.getByRole("status").textContent).toBe("0 条话题");
    expect(screen.queryByRole("list", { name: "发现话题" })).toBeNull();
    expect(screen.getByRole("link", { name: "从热榜第 1 条开始" }).getAttribute("href")).toBe(`/post/${topics.find(({ rank }) => rank === 1)!.id}`);
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(input).toHaveProperty("value", "");
    expect(within(screen.getByRole("list", { name: "发现话题" })).getAllByRole("listitem")).toHaveLength(topics.length);
    expect(screen.queryByRole("link", { name: "从热榜第 1 条开始" })).toBeNull();
  });

  it("按标题、分类、标签、作者匹配，忽略两端空白；空题库不产生无效入口", () => {
    const topics = getAllTopics();
    const { rerender } = render(<DiscoverFeed topics={topics} />);
    const input = screen.getByRole("searchbox", { name: "筛选话题" });
    for (const query of [topics[0].title, topics[0].category, topics[0].tags[0], topics[0].author.name]) {
      fireEvent.change(input, { target: { value: ` ${query} ` } });
      const expected = topics.filter((topic) => [topic.title, topic.category, ...topic.tags, topic.author.name].some((text) => text.includes(query)));
      expect(within(screen.getByRole("list", { name: "发现话题" })).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(expected.map(({ id }) => `/post/${id}`));
    }
    rerender(<DiscoverFeed topics={[]} />);
    expect(screen.getByText("热搜还在准备中")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "从热榜第 1 条开始" })).toBeNull();
  });

  it("完整题库卡片链接相同帖子，封面/两行标题/作者与原创心形统计各一份", () => {
    render(DiscoverPage());
    const topics = getAllTopics().filter((topic) => topic.module === "discover");
    const list = screen.getByRole("list", { name: "发现话题" });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(topics.length);
    cards.forEach((card, index) => {
      const topic = topics[index];
      const link = within(card).getByRole("link");
      expect(link.getAttribute("href")).toBe(`/post/${topic.id}`);
      expect(card.querySelector(".discover-cover")!.getAttribute("src")).toBe(topic.coverUrl);
      expect(within(card).getByRole("heading").textContent).toBe(topic.title);
      expect(card.querySelector(".discover-author")!.textContent).toBe(topic.author.name);
      expect(card.querySelector(".discover-likes")!.getAttribute("title")).toBe(topic.simulatedLikes.toLocaleString("zh-CN"));
      expect(card.querySelector('svg[data-social-icon="like"]')).toBeTruthy();
      expect(within(card).queryByRole("button")).toBeNull();
      expect(within(card).getAllByRole("img")).toHaveLength(2);
      expect(card.textContent).not.toContain(topic.reveal.correctedClaim);
    });
  });

  it("十二位作者使用数据中的独立可读 handle，不含随机数字串", () => {
    const handles = getAllTopics().map((topic) => topic.author.handle);
    expect(new Set(handles).size).toBe(12);
    for (const handle of handles) expect(handle).toMatch(/^@[a-z_]{3,20}$/);
    expect(handles).toContain("@changan_chihuo");
  });
});
