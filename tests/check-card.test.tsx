import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckCardDialog } from "@/components/post/CheckCardDialog";
import h03 from "@/data/topics/h03.json";
import { HotTopicSchema } from "@/lib/schemas";
import { toPublicTopic } from "@/lib/public-topic";
import type { VerdictResult } from "@/lib/verdict";
import { makeSource, makeTopic } from "./fixtures";

const toPng = vi.hoisted(() => vi.fn());
vi.mock("html-to-image", () => ({ toPng }));
const topic = HotTopicSchema.parse(h03);
const result: VerdictResult = { isTrue: false, isCorrect: true, reveal: topic.reveal, sources: [], rewriteOptions: topic.rewriteOptions };
let resize: () => void;
let previewWidth = 320;
const disconnect = vi.fn();
const showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
  previewWidth = 320;
  toPng.mockReset().mockResolvedValue("data:image/png;base64,dGVzdA==");
  disconnect.mockReset();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => previewWidth);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  for (const [name, descriptor] of [["showModal", showModalDescriptor], ["close", closeDescriptor]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

describe("手机查证卡预览与导出", () => {
  it.each([
    { reviewStatus: "pending" as const, sourceStatus: "reviewed" as const, label: "开发预览：本条史实尚待人工审核" },
    { reviewStatus: "reviewed" as const, sourceStatus: "pending" as const, label: "开发预览：本条史实尚待人工审核" },
    { reviewStatus: "reviewed" as const, sourceStatus: "rejected" as const, label: "审核未通过" },
  ])("题目 $reviewStatus、来源 $sourceStatus 的查证卡保留真实状态", ({ reviewStatus, sourceStatus, label }) => {
    const fixture = makeTopic({ reviewStatus });
    render(<CheckCardDialog topic={toPublicTopic(fixture)} result={{ ...result, sources: [makeSource({ status: sourceStatus })] }} onClose={() => {}} />);
    expect(screen.getByTestId("check-card").textContent).toContain(label);
    expect(screen.getByTestId("check-card").textContent).not.toContain("已人工审核");
  });

  it("预览随容器等比缩放，准确说法可直接阅读，下载仍使用 1200×675", async () => {
    render(<CheckCardDialog topic={toPublicTopic(topic)} result={result} onClose={() => {}} />);
    const card = screen.getByTestId("check-card");
    expect(card.textContent).not.toMatch(/架空|虚构|模拟|非史料/);
    expect(card.textContent).toContain("已人工审核");
    expect(card.textContent).not.toContain("待人工审核");
    expect(card.querySelector('svg[data-status-icon="refuted"][aria-hidden="true"]')).toBeTruthy();
    expect(card.parentElement!.style.transform).toBe(`scale(${320 / 1200})`);
    previewWidth = 280;
    act(() => resize());
    await waitFor(() => expect(card.parentElement!.style.transform).toBe(`scale(${280 / 1200})`));
    expect(card.style.width).toBe("1200px");
    expect(card.style.height).toBe("675px");
    expect(screen.getAllByText(topic.reveal.correctedClaim)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "下载 PNG" }));
    await waitFor(() => expect(toPng).toHaveBeenCalledExactlyOnceWith(card, expect.objectContaining({ width: 1200, height: 675, canvasWidth: 1200, canvasHeight: 675, pixelRatio: 1 })));
  });

  it("导出失败显示错误且可以重试；关闭后恢复触发按钮焦点并移除尺寸监听", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    toPng.mockRejectedValueOnce(new Error("export failed"));
    const { unmount } = render(<CheckCardDialog topic={toPublicTopic(topic)} result={result} onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "关闭预览" }));
    fireEvent.click(screen.getByRole("button", { name: "下载 PNG" }));
    expect((await screen.findByRole("alert")).textContent).toBe("图片导出失败，请重试。");
    fireEvent.click(screen.getByRole("button", { name: "下载 PNG" }));
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
