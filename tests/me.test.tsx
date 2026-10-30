import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeTabs } from "@/components/me/MeTabs";
import StickersPage from "@/app/stickers/page";
import { getAllTopics } from "@/lib/topics";
import { getSticker } from "@/lib/stickers";
import { writeSocialState } from "@/lib/social-storage";
import { saveProgress } from "@/lib/progress";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ replace: navigation.replace }),
  redirect: navigation.redirect,
}));
const topics = getAllTopics().map(({ id, title, module }) => ({ id, title, module }));
const props = { topics, stickers: topics.map(({ id }) => getSticker(id)), firstTopicId: topics[0].id };

beforeEach(() => {
  localStorage.clear();
  navigation.search = "";
  navigation.replace.mockReset().mockImplementation((url: string) => { navigation.search = url.split("?")[1]; });
  navigation.redirect.mockReset().mockImplementation(() => { throw Error("NEXT_REDIRECT"); });
});
afterEach(cleanup);

describe("我的子标签与旧入口", () => {
  it.each(["", "tab=stickers", "tab=unknown"])("%s 默认展示贴纸墙与已查证进度，隐藏收藏", (query) => {
    navigation.search = query;
    saveProgress({ topicId: "H03", selectedAnswer: false, revealed: true });
    render(<MeTabs {...props} />);
    const tabs = screen.getByRole("tablist", { name: "我的内容" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["贴纸", "收藏"]);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("贴纸");
    expect(screen.getByRole("tabpanel", { name: "贴纸" }).id).toBe(screen.getByRole("tab", { name: "贴纸" }).getAttribute("aria-controls"));
    expect(screen.getByRole("status").textContent).toBe("已查证 1/12");
    expect(screen.getByRole("list", { name: "贴纸收藏" }).children).toHaveLength(12);
    expect(screen.queryByRole("heading", { name: /我的收藏/ })).toBeNull();
  });

  it("?tab=favorites 直达收藏，点击贴纸可切回且不改进度与收藏", () => {
    navigation.search = "tab=favorites";
    writeSocialState({ H01: { liked: true, saved: true }, H05: { liked: false, saved: true } });
    const stored = localStorage.getItem("ahsd:social:v1");
    const view = render(<MeTabs {...props} />);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("收藏");
    expect(screen.getByRole("tabpanel", { name: "收藏" }).tabIndex).toBe(0);
    expect(within(screen.getByRole("list", { name: "我的收藏" })).getAllByRole("link").map((node) => node.getAttribute("href"))).toEqual(["/post/H01", "/post/H05"]);
    expect(screen.queryByRole("list", { name: "贴纸收藏" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "贴纸" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/me?tab=stickers", { scroll: false });
    view.rerender(<MeTabs {...props} />);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("贴纸");
    fireEvent.click(screen.getByRole("tab", { name: "收藏" }));
    view.rerender(<MeTabs {...props} />);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("收藏");
    expect(localStorage.getItem("ahsd:social:v1")).toBe(stored);
  });

  it("方向键循环、Home/End 更新选择与焦点，仅选中标签进入 Tab 顺序", () => {
    const view = render(<MeTabs {...props} />);
    for (const [key, label] of [["ArrowRight", "收藏"], ["ArrowRight", "贴纸"], ["ArrowLeft", "收藏"], ["Home", "贴纸"], ["End", "收藏"]]) {
      fireEvent.keyDown(screen.getByRole("tab", { selected: true }), { key });
      view.rerender(<MeTabs {...props} />);
      const active = screen.getByRole("tab", { selected: true });
      expect(active.textContent).toBe(label);
      expect(document.activeElement).toBe(active);
      expect(active.tabIndex).toBe(0);
      expect(screen.getByRole("tab", { selected: false }).tabIndex).toBe(-1);
    }
  });

  it("旧 /stickers 服务端跳转 /me", () => {
    expect(() => StickersPage()).toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledExactlyOnceWith("/me");
  });
});
