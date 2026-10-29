import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import h03 from "@/data/topics/h03.json";
import sources from "@/data/source-index.json";
import { Comments } from "@/components/post/Comments";
import { RewriteExercise } from "@/components/post/RewriteExercise";
import { VerdictTask } from "@/components/post/VerdictTask";
import { toPublicTopic } from "@/lib/public-topic";
import { HotTopicSchema, SourceSchema } from "@/lib/schemas";
import { PROGRESS_KEY, readProgress, saveProgress } from "@/lib/progress";
import type { VerdictResult } from "@/lib/verdict";

const topic = HotTopicSchema.parse(h03);
const publicTopic = toPublicTopic(topic);
function result(overrides: Partial<VerdictResult> = {}): VerdictResult {
  return { isTrue: false, isCorrect: true, reveal: topic.reveal, sources: sources.filter((source) => topic.sourceIds.includes(source.id)).map((source) => SourceSchema.parse(source)), rewriteOptions: topic.rewriteOptions, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => result() }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("真假判断与揭晓", () => {
  it("未选禁用提交，提交前可以改选，提交后锁定且显示假题、答对文案", async () => {
    render(<VerdictTask topic={publicTopic} />);
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("谣言退散")).toBeNull();
    expect(screen.queryByRole("heading", { name: "这条热搜，还想问什么？" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "是真的" }));
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    expect(screen.getByRole("radio", { name: "是假的" })).toHaveProperty("checked", true);
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    expect(screen.getByRole("heading", { name: "这条热搜，还想问什么？" })).toBeTruthy();
    expect(screen.getByText("核心主张为假。")).toBeTruthy();
    expect(screen.getByText("答对了！这次吃瓜有依据。")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "是真的" }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: "是假的" }).matches(":disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "提交判断" })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/verdict", expect.objectContaining({ body: JSON.stringify({ topicId: "H03", answer: false }) }));
    expect(readProgress("H03")?.revealed).toBe(true);
    expect(readProgress("H03")?.selectedAnswer).toBe(false);
    expect(screen.getAllByText("待人工审核")).toHaveLength(3);
  });

  it("答错也揭晓，不阻塞查证卡", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result({ isCorrect: false }) } as Response);
    render(<VerdictTask topic={publicTopic} />);
    fireEvent.click(screen.getByRole("radio", { name: "是真的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText("这次答错了，带走一个新知识。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "生成查证卡" })).toHaveProperty("disabled", false);
  });

  it("合成真题显示查证属实（不新增正式题目）", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result({ isTrue: true }) } as Response);
    render(<VerdictTask topic={{ ...publicTopic, id: "SYNTHETIC-TRUE", claim: "合成真题主张" }} />);
    fireEvent.click(screen.getByRole("radio", { name: "是真的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText("查证属实")).toBeTruthy();
    expect(screen.getByText("核心主张为真。")).toBeTruthy();
    expect(screen.queryByText("谣言退散")).toBeNull();
  });

  it("刷新时用保存的 false 再请求接口，恢复改写并保持原提交时间", async () => {
    saveProgress({ topicId: "H03", selectedAnswer: false, submittedAt: "2026-10-29T12:00:00Z", revealed: true, selectedRewriteOptionId: "C" });
    const before = localStorage.getItem(PROGRESS_KEY);
    render(<VerdictTask topic={publicTopic} />);
    expect(await screen.findByText("重温本条 · 已恢复上次答案，不重复计分。")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/verdict", expect.objectContaining({ body: JSON.stringify({ topicId: "H03", answer: false }) }));
    expect(screen.getByText("改写正确，这样说更准确。")).toBeTruthy();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
  });

  it("请求失败保留选择，可再次提交", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<VerdictTask topic={publicTopic} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText("谣言退散")).toBeTruthy();
  });

  it("恢复接口失败后可重试，仍锁定旧答案", async () => {
    saveProgress({ topicId: "H03", selectedAnswer: false, revealed: true });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<VerdictTask topic={publicTopic} />);
    fireEvent.click(await screen.findByRole("button", { name: "重试恢复" }));
    await screen.findByText("谣言退散");
    expect(screen.getByRole("radio", { name: "是真的" }).matches(":disabled")).toBe(true);
    expect(screen.getByText("重温本条 · 已恢复上次答案，不重复计分。")).toBeTruthy();
  });

  it("localStorage 抛错时仍可提交揭晓", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    render(<VerdictTask topic={publicTopic} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    expect(screen.getByText(/本机存储不可用/)).toBeTruthy();
  });
});

describe("评论与改写", () => {
  it("默认四条，展开八条，再收起到四条", () => {
    render(<Comments comments={topic.comments} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /展开更多评论/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "收起评论" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("改写选择显示对应反馈与正确项，可改选", () => {
    function Exercise() {
      const [id, setId] = useState<string>();
      return <RewriteExercise options={topic.rewriteOptions} selectedId={id} onSelect={setId} />;
    }
    render(<Exercise />);
    fireEvent.click(screen.getByRole("button", { name: /^A / }));
    expect(screen.getByText(topic.rewriteOptions[0].feedback)).toBeTruthy();
    expect(screen.getByText("正确项：C")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^C / }));
    expect(screen.getByText(topic.rewriteOptions[2].feedback)).toBeTruthy();
    expect(screen.getByText("改写正确，这样说更准确。")).toBeTruthy();
  });

  it("改写选择写回进度", async () => {
    render(<VerdictTask topic={publicTopic} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    fireEvent.click(screen.getByRole("button", { name: /^C / }));
    await waitFor(() => expect(readProgress("H03")?.selectedRewriteOptionId).toBe("C"));
  });
});
