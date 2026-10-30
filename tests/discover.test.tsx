import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DiscoverPage from "@/app/discover/page";
import { getAllTopics } from "@/lib/topics";
import { authorHandle } from "@/lib/social-display";

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

  it("handle 由作者数据确定，同名稳定、不同名独立，不暴露个人资料", () => {
    expect(authorHandle("洛阳同城小助手")).toBe(authorHandle("洛阳同城小助手"));
    expect(authorHandle("洛阳同城小助手")).not.toBe(authorHandle("认真读诗的"));
    for (const topic of getAllTopics()) expect(authorHandle(topic.author.name)).toMatch(/^@guwen_[a-z0-9]+$/);
  });
});
