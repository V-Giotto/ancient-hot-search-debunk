import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import TrendingPage from "@/app/trending/page";
import DiscoverPage from "@/app/discover/page";

const route = vi.hoisted(() => ({ pathname: "/trending" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("AppShell 内容模式提示", () => {
  it("服务端 CONTENT_MODE=preview 时显示开发预览条", () => {
    vi.stubEnv("CONTENT_MODE", "preview");
    render(<AppShell><p>页面内容</p></AppShell>);
    expect(screen.getByRole("note").textContent).toContain("开发预览模式");
    expect(screen.getByRole("note").textContent).toContain("本条史实尚待人工审核");
    expect(screen.getByText("页面内容")).toBeTruthy();
  });

  it.each(["formal", undefined, "", "invalid"])("CONTENT_MODE=%j 时不渲染开发预览条，仍展示页面内容", (mode) => {
    vi.stubEnv("CONTENT_MODE", mode);
    render(<AppShell><p>页面内容</p></AppShell>);
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByText("开发预览模式")).toBeNull();
    expect(screen.queryByText(/本条史实尚待人工审核/)).toBeNull();
    expect(screen.getByText("页面内容")).toBeTruthy();
  });
});

describe("移动端共用壳层", () => {
  it.each(["/trending", "/discover", "/stickers", "/post/H03", "/missing"])("%s 保留三 Tab 与主内容内可展开的公告、守则", (pathname) => {
    route.pathname = pathname;
    render(<AppShell><h1>页面内容</h1></AppShell>);
    const navigation = screen.getByRole("navigation", { name: "主导航" });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute("href")])).toEqual([["#热搜榜", "/trending"], ["◫发现", "/discover"], ["▧贴纸", "/stickers"]]);
    for (const link of links) expect(link.getAttribute("aria-current")).toBe(pathname === link.getAttribute("href") ? "page" : null);
    const main = screen.getByRole("main");
    const information = within(main).getByRole("complementary", { name: "辟谣局信息" });
    for (const title of ["辟谣局公告", "今天的吃瓜守则"]) {
      const summary = within(information).getByText(title);
      const details = summary.closest("details")!;
      expect(details.open).toBe(false);
      fireEvent.click(summary);
      expect(details.open).toBe(true);
    }
    expect(within(information).getByText(/提交后可查看结论与来源/)).toBeTruthy();
    expect(within(information).getByText(/查阅来源，留意时间与范围/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/虚构|架空|模拟|非史料|不是历史人物原话|现代类比/);
    expect(screen.queryByText(/二维码|扫码|QR/)).toBeNull();
  });

  it.each([TrendingPage, DiscoverPage])("列表页移除标签，保留话题、统计和来源阅读入口：%s", (Page) => {
    render(<AppShell>{Page()}</AppShell>);
    expect(document.body.textContent).not.toMatch(/虚构|架空|模拟|非史料/);
    expect(screen.getByRole("main").querySelectorAll('a[href^="/post/"]')).toHaveLength(12);
    if (Page === DiscoverPage) expect(screen.getByTitle("35,600").textContent).toContain("3.6万");
    else expect(screen.getByText("128.6 万热度")).toBeTruthy();
  });
});
