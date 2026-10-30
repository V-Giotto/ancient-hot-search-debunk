import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/trending" }));

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
