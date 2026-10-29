import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_KEY, readProgress, saveProgress } from "@/lib/progress";
import type { TopicProgress } from "@/lib/schemas";

const progress: TopicProgress = { topicId: "H03", selectedAnswer: false, submittedAt: "2026-10-29T12:00:00Z", revealed: true, selectedRewriteOptionId: "C" };

beforeEach(() => window.localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("版本化本机进度", () => {
  it("使用 v1 key，保存与读取显式 false 和改写", () => {
    expect(PROGRESS_KEY).toBe("ahsd:progress:v1");
    expect(readProgress("H03")).toBeUndefined();
    expect(saveProgress(progress)).toBe(true);
    expect(readProgress("H03")).toEqual(progress);
    expect(window.localStorage.getItem(PROGRESS_KEY)).toContain('"selectedAnswer":false');
  });

  it("保存一条不覆盖其他条目的进度，更新可覆盖同条", () => {
    saveProgress({ topicId: "TEST", revealed: false });
    saveProgress(progress);
    saveProgress({ ...progress, selectedRewriteOptionId: "A" });
    expect(readProgress("TEST")).toEqual({ topicId: "TEST", revealed: false });
    expect(readProgress("H03")?.selectedRewriteOptionId).toBe("A");
  });

  it.each(["{broken", "null", "[]", '{"H03":{"topicId":"OTHER","revealed":true}}', '{"H03":{"topicId":"H03","revealed":"true"}}'])("损坏或非法数据安全降级：%s", (raw) => {
    window.localStorage.setItem(PROGRESS_KEY, raw);
    expect(readProgress("H03")).toBeUndefined();
    expect(saveProgress(progress)).toBe(true);
    expect(readProgress("H03")).toEqual(progress);
  });

  it("旧版本 key 不会被误读", () => {
    window.localStorage.setItem("ahsd:progress:v0", JSON.stringify({ H03: progress }));
    expect(readProgress("H03")).toBeUndefined();
  });

  it("localStorage getter 被禁止时安全降级", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("SecurityError"); });
    expect(readProgress("H03")).toBeUndefined();
    expect(saveProgress(progress)).toBe(false);
  });

  it("读取或写入抛错时不使页面崩溃", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(readProgress("H03")).toBeUndefined();
    expect(saveProgress(progress)).toBe(false);
  });

  it("无 window 的服务端环境也安全", () => {
    vi.stubGlobal("window", undefined);
    expect(readProgress("H03")).toBeUndefined();
    expect(saveProgress(progress)).toBe(false);
  });
});
