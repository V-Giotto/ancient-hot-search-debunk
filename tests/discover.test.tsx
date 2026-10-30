import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DiscoverPage from "@/app/discover/page";
import { getAllTopics } from "@/lib/topics";

afterEach(cleanup);

describe("发现页", () => {
  it("完整题库卡片链接相同帖子，封面/两行标题/作者与原创心形统计各一份", () => {
    render(DiscoverPage());
    const topics = getAllTopics();
    const list = screen.getByRole("list", { name: "发现话题" });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(topics.length);
    cards.forEach((card, index) => {
      const topic = topics[index];
      const link = within(card).getByRole("link");
      expect(link.getAttribute("href")).toBe(`/post/${topic.id}`);
      expect(card.querySelector(".discover-cover")!.getAttribute("src")).toBe(topic.coverUrl);
      expect(within(card).getByRole("heading").textContent).toBe(topic.title.replaceAll("#", "").replace("家人们谁懂啊！", ""));
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
