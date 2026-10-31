import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PixelIcon, pixelIcons, type PixelIconName, type PixelIconSize } from "@/components/pixel/PixelIcon";
import { PixelSticker, pixelStickers } from "@/components/pixel/PixelSticker";
import { SocialIcon } from "@/components/social/SocialIcon";
import { StatusIcon, type StatusIconName } from "@/components/social/StatusIcon";
import { StickerBadge } from "@/components/stickers/StickerBadge";
import { PostActions } from "@/components/post/PostActions";
import { getSticker } from "@/lib/stickers";
import { getAllTopics } from "@/lib/topics";
import { toPublicTopic } from "@/lib/public-topic";

beforeEach(() => localStorage.clear());
afterEach(cleanup);
const sizes: PixelIconSize[] = [16, 20, 24, 32];
const names = Object.keys(pixelIcons) as PixelIconName[];

describe("原创像素图标系统", () => {
  it.each(names)("%s 在四种尺寸使用整数像素、currentColor 与装饰性 aria", (name) => {
    for (const size of sizes) {
      const { container, unmount } = render(<PixelIcon name={name} size={size} />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
      expect(svg.getAttribute("viewBox")).toBe(`0 0 ${size} ${size}`);
      expect(svg.getAttribute("width")).toBe(String(size));
      expect(svg.getAttribute("height")).toBe(String(size));
      expect(svg.getAttribute("fill")).toBe("currentColor");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(svg.querySelectorAll("path")).toHaveLength(1);
      const path = svg.querySelector("path")!.getAttribute("d")!;
      expect(path).toMatch(/^M[\d MHVZ]+$/);
      expect(path).not.toContain(".");
      for (const value of path.match(/\d+/g)!) expect(Number(value)).toBeLessThanOrEqual(size);
      expect(svg.querySelector("circle, ellipse, line, polyline, image, text")).toBeNull();
      unmount();
    }
  });

  it.each(names)("%s 可独立提供可访问名称，且不隐藏命名图像", (name) => {
    render(<PixelIcon name={name} aria-label={`图标：${name}`} />);
    const icon = screen.getByRole("img", { name: `图标：${name}` });
    expect(icon.hasAttribute("aria-hidden")).toBe(false);
    expect(icon.getAttribute("focusable")).toBe("false");
  });

  it.each(["burst", "flame", "spark", "verified", "refuted"] as StatusIconName[])("状态 %s 保留语义标识，旁边文字提供名称", (name) => {
    const { container } = render(<StatusIcon name={name} />);
    expect(container.querySelector(`[data-status-icon="${name}"][data-pixel-icon="${name}"][aria-hidden="true"]`)).toBeTruthy();
  });

  it.each(["like", "bookmark"] as const)("%s 切换实体图形及视觉类名，同时保留 aria-pressed 与名称", (name) => {
    const label = name === "like" ? "点赞" : "收藏";
    const selectedClass = name === "like" ? "is-liked" : "is-saved";
    render(<PostActions topic={toPublicTopic(getAllTopics()[0])} />);
    const button = screen.getByRole("button", { name: label });
    const outline = button.querySelector("path")!.getAttribute("d");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.classList.contains(selectedClass)).toBe(false);
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.classList.contains(selectedClass)).toBe(true);
    expect(button.querySelector(`[data-pixel-icon="${name}Filled"].pixel-icon-selected[aria-hidden="true"]`)).toBeTruthy();
    expect(button.querySelector("path")!.getAttribute("d")).not.toBe(outline);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.getAttribute("aria-live")).toBe("polite");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.classList.contains(selectedClass)).toBe(false);
    expect(button.querySelector("path")!.getAttribute("d")).toBe(outline);
  });

  it("全部社交统计图标隐藏于辅助技术，保留兼容标识", () => {
    const { container } = render(<>{(["reply", "repost", "like", "views", "bookmark"] as const).map((name) => <SocialIcon key={name} name={name} />)}</>);
    expect(container.querySelectorAll("[data-social-icon][data-pixel-icon][aria-hidden=true]")).toHaveLength(5);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});

describe("二十二枚主题像素贴纸", () => {
  it("每题都有独立原创图形，名称与题目数量对应", () => {
    expect(Object.keys(pixelStickers)).toEqual(getAllTopics().map(({ id }) => id));
    const shapes = Object.values(pixelStickers).map((layers) => JSON.stringify(layers));
    expect(new Set(shapes).size).toBe(22);
  });
  it.each(Object.keys(pixelStickers))("%s 解锁渲染彩色贴纸，锁定仅灰色剪影与像素问号，无结论文本", (id) => {
    const { container, rerender } = render(<StickerBadge sticker={getSticker(id)} unlocked />);
    const unlocked = container.querySelector("svg")!;
    expect(unlocked.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(unlocked.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(container.querySelector(".sticker-unlocked")).toBeTruthy();
    expect(new Set([...unlocked.querySelectorAll("path")].map((p) => p.getAttribute("fill"))).size).toBeGreaterThan(2);
    rerender(<StickerBadge sticker={getSticker(id)} unlocked={false} />);
    expect(container.querySelector(".sticker-locked")).toBeTruthy();
    expect(container.querySelector("[data-sticker-state=locked][aria-hidden=true]")).toBeTruthy();
    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(container.querySelector("[data-pixel-question]")).toBeTruthy();
    expect(container.querySelector("text, image, title")).toBeNull();
    expect(container.textContent).toBe("");
  });
  it("未知题目安全使用中性竹简图形", () => {
    const { container } = render(<PixelSticker id="H99" unlocked={false} />);
    expect(container.querySelector("[data-pixel-question]")).toBeTruthy();
  });
});

it("components / app 没有旧内联 SVG 或 Unicode 图标，绘图仅由像素组件提供", () => {
  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".tsx") ? [join(dir, entry.name)] : []);
  }
  for (const file of [...files("components"), ...files("app")]) {
    const source = readFileSync(file, "utf8");
    if (!file.replaceAll("\\", "/").startsWith("components/pixel/")) expect(source, file).not.toMatch(/<svg\b/);
    expect(source, file).not.toMatch(/[←→↗↘↙↖↑↓▶▼▲◀⌄⌃✕♥♡★☆🔥👀💬🔗🔍➜↩✔✓✖◫▧]/u);
  }
});
