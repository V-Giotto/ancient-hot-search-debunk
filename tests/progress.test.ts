import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_KEY, readCollectionProgress, readProgress, saveProgress } from "@/lib/progress";
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
    expect(readCollectionProgress(["H03"])).toEqual({ completedIds: [], total: 1, storageAvailable: false });
  });

  it("读取或写入抛错时不使页面崩溃", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(readProgress("H03")).toBeUndefined();
    expect(saveProgress(progress)).toBe(false);
    expect(readCollectionProgress(["H03"])).toEqual({ completedIds: [], total: 1, storageAvailable: false });
  });

  it("无 window 的服务端环境也安全", () => {
    vi.stubGlobal("window", undefined);
    expect(readProgress("H03")).toBeUndefined();
    expect(saveProgress(progress)).toBe(false);
    expect(readCollectionProgress(["H03"])).toEqual({ completedIds: [], total: 1, storageAvailable: false });
  });
});

describe("贴纸与完成度", () => {
  it("仅已提交揭晓且有答案的记录计数，true/false 均可收集", () => {
    saveProgress(progress);
    saveProgress({ topicId: "H02", selectedAnswer: true, revealed: true });
    saveProgress({ topicId: "H01", selectedAnswer: false, revealed: false });
    saveProgress({ topicId: "H04", revealed: true });
    expect(readCollectionProgress(["H01", "H02", "H03", "H04"])).toEqual({ completedIds: ["H02", "H03"], total: 4, storageAvailable: true });
  });

  it("重温与改写不重复计数，题库扩容保留已有记录，移除条目不计入", () => {
    saveProgress(progress);
    saveProgress({ ...progress, selectedRewriteOptionId: "A" });
    saveProgress({ topicId: "OLD", selectedAnswer: true, revealed: true });
    expect(readCollectionProgress(["H03", "H03"]).completedIds).toEqual(["H03"]);
    for (const total of [8, 12, 16]) {
      const ids = Array.from({ length: total }, (_, i) => `H${String(i + 1).padStart(2, "0")}`);
      expect(readCollectionProgress(ids)).toEqual({ completedIds: ["H03"], total, storageAvailable: true });
    }
    expect(readCollectionProgress([])).toEqual({ completedIds: [], total: 0, storageAvailable: true });
  });

  it("损坏记录不计数，也不影响有效记录", () => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      H01: { ...progress, topicId: "H03" },
      H02: { topicId: "H02", selectedAnswer: "true", revealed: true },
      H03: progress,
      H04: { topicId: "H04", selectedAnswer: true, revealed: "true" },
    }));
    expect(readCollectionProgress(["H01", "H02", "H03", "H04"]).completedIds).toEqual(["H03"]);
    localStorage.setItem(PROGRESS_KEY, "{broken");
    expect(readCollectionProgress(["H03"]).completedIds).toEqual([]);
  });

  it("写入失败不产生虚假的持久收集，原有进度仍可读", () => {
    saveProgress(progress);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(saveProgress({ topicId: "H02", selectedAnswer: true, revealed: true })).toBe(false);
    expect(readCollectionProgress(["H02", "H03"]).completedIds).toEqual(["H03"]);
  });

  it("清除当前 key 或全部本机存储后归零，不从旧版本恢复", () => {
    saveProgress(progress);
    localStorage.setItem("ahsd:progress:v0", JSON.stringify({ H03: progress }));
    localStorage.removeItem(PROGRESS_KEY);
    expect(readCollectionProgress(["H03"]).completedIds).toEqual([]);
    saveProgress(progress);
    localStorage.clear();
    expect(readCollectionProgress(["H03"]).completedIds).toEqual([]);
  });
});
