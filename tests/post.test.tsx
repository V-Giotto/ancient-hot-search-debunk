import { Activity, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import h03 from "@/data/topics/h03.json";
import sources from "@/data/source-index.json";
import { Comments } from "@/components/post/Comments";
import { RewriteExercise } from "@/components/post/RewriteExercise";
import { VerdictTask } from "@/components/post/VerdictTask";
import { PostExperience } from "@/components/post/PostExperience";
import { toPublicTopic } from "@/lib/public-topic";
import { HotTopicSchema, SourceSchema } from "@/lib/schemas";
import { PROGRESS_KEY, readCollectionProgress, readProgress, saveProgress } from "@/lib/progress";
import type { VerdictResult } from "@/lib/verdict";
import { compactCount } from "@/lib/social-display";
import { getAllTopics } from "@/lib/topics";

const topic = HotTopicSchema.parse(h03);
const publicTopic = toPublicTopic(topic);
const topicIds = getAllTopics().map((topic) => topic.id);
const scrollIntoView = vi.fn();
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
function result(overrides: Partial<VerdictResult> = {}): VerdictResult {
  return { isTrue: false, isCorrect: true, reveal: topic.reveal, sources: sources.filter((source) => topic.sourceIds.includes(source.id)).map((source) => SourceSchema.parse(source)), rewriteOptions: topic.rewriteOptions, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => result() }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("真假判断与揭晓", () => {
  it("帖子与评论保留数字，移除账号、图注和互动免责声明", () => {
    const { container } = render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    expect(container.textContent).not.toMatch(/虚构|架空|模拟|非史料/);
    expect(screen.getByLabelText("互动统计").textContent).toContain(compactCount(topic.simulatedLikes));
    expect(container.querySelector("figcaption")).toBeNull();
    expect(container.querySelectorAll("img").length).toBeGreaterThan(0);
    for (const image of container.querySelectorAll("img")) expect(image.alt).not.toMatch(/虚构|架空|非史料/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("未选禁用提交，提交前可以改选，提交后锁定且显示假题、答对文案", async () => {
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("谣言退散")).toBeNull();
    expect(screen.queryByRole("heading", { name: "这条热搜，还想问什么？" })).toBeNull();
    expect(screen.queryByRole("link", { name: "问问 AI" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "是真的" }));
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    expect(screen.getByRole("radio", { name: "是假的" })).toHaveProperty("checked", true);
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    expect(screen.getByRole("heading", { name: "这条热搜，还想问什么？" })).toBeTruthy();
    const stamp = screen.getByText("谣言退散").closest(".verdict-stamp")!;
    expect(stamp.querySelector('svg[data-status-icon="refuted"][aria-hidden="true"]')).toBeTruthy();
    expect(stamp.textContent).toContain("核心主张为假。");
    expect(stamp.querySelector(".sr-only")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /明确答案/ })).toBeNull();
    expect(screen.getByText("答对了！这次吃瓜有依据。")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "是真的" }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: "是假的" }).matches(":disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "提交判断" })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/verdict", expect.objectContaining({ body: JSON.stringify({ topicId: "H03", answer: false }) }));
    expect(readProgress("H03")?.revealed).toBe(true);
    expect(readProgress("H03")?.selectedAnswer).toBe(false);
    const sticker = screen.getByRole("region", { name: "本题贴纸" });
    expect(sticker.textContent).toContain(`获得贴纸：饭局手记 · 已查证 1/${topicIds.length}`);
    expect(sticker.getAttribute("aria-live")).toBe("polite");
    expect(sticker.getAttribute("aria-atomic")).toBe("true");
    expect(within(sticker).getByRole("link", { name: "去贴纸墙 →" }).getAttribute("href")).toBe("/stickers");
    expect(screen.getByRole("region", { name: topic.reveal.verdictHeadline }).contains(sticker)).toBe(true);
  });

  it("揭晓首屏入口链接到 AI 标题，点击后转移键盘焦点", async () => {
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    const link = await screen.findByRole("link", { name: "问问 AI" });
    expect(link.getAttribute("href")).toBe("#ask-heading");
    expect(link.closest(".reveal-panel")).toBeTruthy();
    fireEvent.click(link);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "这条热搜，还想问什么？" }));
    expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
  });

  it("答错也揭晓，不阻塞查证卡", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result({ isCorrect: false }) } as Response);
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是真的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText("这次答错了，带走一个新知识。")).toBeTruthy();
    expect(screen.getByRole("region", { name: "本题贴纸" }).textContent).toContain(`获得贴纸：饭局手记 · 已查证 1/${topicIds.length}`);
    expect(screen.getByText("这次答错了，带走一个新知识。").closest("[role=status]")?.classList.contains("feedback-incorrect")).toBe(true);
    expect(readProgress("H03")?.revealed).toBe(true);
    expect(screen.getByRole("button", { name: "生成查证卡" })).toHaveProperty("disabled", false);
  });

  it.each([
    { reducedMotion: false, behavior: "smooth" },
    { reducedMotion: true, behavior: "instant" },
  ])("主动提交后聚焦标题并滚动到完整结果区：reducedMotion=$reducedMotion，behavior=$behavior", async ({ reducedMotion, behavior }) => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: reducedMotion } as MediaQueryList);
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    expect(scrollIntoView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    const submit = screen.getByRole("button", { name: "提交判断" });
    submit.focus();
    fireEvent.click(submit);
    await screen.findByText("谣言退散");
    const heading = screen.getByRole("heading", { name: topic.reveal.verdictHeadline });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior, block: "start" });
    expect(scrollIntoView.mock.contexts[0]).toBe(heading.closest(".reveal-panel"));
    fireEvent.click(screen.getByRole("button", { name: /^C / }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("合成真题显示查证属实（不新增正式题目）", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result({ isTrue: true }) } as Response);
    render(<VerdictTask topic={{ ...publicTopic, id: "SYNTHETIC-TRUE", claim: "合成真题主张" }} topicIds={["SYNTHETIC-TRUE"]} />);
    fireEvent.click(screen.getByRole("radio", { name: "是真的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText("查证属实")).toBeTruthy();
    expect(screen.getByText("查证属实").closest(".verdict-stamp")?.textContent).toContain("核心主张为真。");
    expect(screen.getByText("查证属实").closest(".verdict-stamp")?.querySelector('svg[data-status-icon="verified"][aria-hidden="true"]')).toBeTruthy();
    expect(screen.queryByText("谣言退散")).toBeNull();
  });

  it.each([false, true])("旧版答案 %s 与改写只用于识别收藏，进入不恢复 UI，改选及重答不改写收集记录", async (selectedAnswer) => {
    saveProgress({ topicId: "H03", selectedAnswer, submittedAt: "2026-10-29T12:00:00Z", revealed: true, selectedRewriteOptionId: "C" });
    const before = localStorage.getItem(PROGRESS_KEY);
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    expect(fetch).not.toHaveBeenCalled();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveProperty("checked", false);
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(screen.queryByText("谣言退散")).toBeNull();
    expect(screen.queryByText("改写正确，这样说更准确。")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: selectedAnswer ? "是假的" : "是真的" }));
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(scrollIntoView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("改写正确，这样说更准确。")).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(screen.queryByText(/获得贴纸/)).toBeNull();
    expect(screen.getByRole("region", { name: "本题贴纸" }).textContent).toContain("饭局手记 · 已收藏");
    expect(readCollectionProgress(topicIds).completedIds).toEqual(["H03"]);
  });

  it.each([false, true])("旧版未揭晓草稿 %s 不恢复、不计数，本次选择也不持久保存", (selectedAnswer) => {
    saveProgress({ topicId: "H03", selectedAnswer, revealed: false });
    const before = localStorage.getItem(PROGRESS_KEY);
    render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    expect(screen.getAllByRole("radio").every((node) => !(node as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(readCollectionProgress(topicIds).completedIds).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("请求失败保留选择，可再次提交", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "本题贴纸" })).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText("谣言退散")).toBeTruthy();
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "smooth", block: "start" });
  });

  it.each(["{broken", "null", "[]", '{"H03":{"revealed":"true"}}'])("损坏旧数据 %s 不影响进入与首次收集", async (stored) => {
    localStorage.setItem(PROGRESS_KEY, stored);
    render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText(`获得贴纸：饭局手记 · 已查证 1/${topicIds.length}`)).toBeTruthy();
  });

  it("localStorage 抛错时仍可提交揭晓", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    expect(screen.getByText(/本机存储不可用/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "本题贴纸" }).textContent).toContain("本次已解锁");
    expect(screen.getByRole("region", { name: "本题贴纸" }).textContent).toContain(`已查证 1/${topicIds.length}`);
  });

  it("揭晓依次展示印章、彩色结果条、准确说法，解释/全部来源/延伸默认折叠且均可展开", async () => {
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    const reveal = screen.getByRole("region", { name: topic.reveal.verdictHeadline });
    const order = [...reveal.querySelectorAll(".verdict-stamp-row, .verdict-feedback, .corrected-claim")].map((node) => node.classList[0]);
    expect(order).toEqual(["verdict-stamp-row", "verdict-feedback", "corrected-claim"]);
    const feedback = reveal.querySelector(".verdict-feedback")!;
    expect(feedback.classList.contains("feedback-correct")).toBe(true);
    expect(feedback.querySelector('[aria-hidden="true"]')?.textContent).toBe("✓");
    const details = [...reveal.querySelectorAll("details")];
    expect(details).toHaveLength(3);
    expect(details.every((section) => !section.open)).toBe(true);
    for (const section of details) fireEvent.click(section.querySelector("summary")!);
    expect(details.every((section) => section.open)).toBe(true);
    for (const field of ["shortExplanation", "detailedExplanation", "correctedClaim", "funFact"] as const) {
      expect(within(reveal).getByText(topic.reveal[field], { exact: true })).toBeTruthy();
    }
    expect(within(reveal).getAllByText("已人工审核")).toHaveLength(topic.sourceIds.length);
    const links = within(reveal).getAllByRole("link").filter((link) => link.getAttribute("target") === "_blank");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(result().sources.map((source) => source.url));
  });

  it("贴纸即时计数只统计题库中的不同已揭晓题目，忽略草稿和旧题", async () => {
    saveProgress({ topicId: "H01", selectedAnswer: false, revealed: true });
    saveProgress({ topicId: "H02", selectedAnswer: true, revealed: false });
    saveProgress({ topicId: "OLD", selectedAnswer: false, revealed: true });
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    expect(await screen.findByText(`获得贴纸：饭局手记 · 已查证 2/${topicIds.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^C / }));
    expect(screen.getByText(`获得贴纸：饭局手记 · 已查证 2/${topicIds.length}`)).toBeTruthy();
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

  it("改写选择只在本次页面内生效，不写回持久进度", async () => {
    render(<VerdictTask topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    const before = localStorage.getItem(PROGRESS_KEY);
    fireEvent.click(screen.getByRole("button", { name: /^C / }));
    expect(screen.getByText("改写正确，这样说更准确。")).toBeTruthy();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
    expect(readProgress("H03")?.selectedRewriteOptionId).toBeUndefined();
  });
});

describe("整帖重新交互", () => {
  async function answerAndRewrite() {
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    fireEvent.click(screen.getByRole("button", { name: /^C / }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "本次问题" } });
  }

  function expectFresh() {
    expect(screen.getAllByRole("radio").every((node) => !(node as HTMLInputElement).checked && !node.matches(":disabled"))).toBe(true);
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(screen.queryByText("谣言退散")).toBeNull();
    expect(screen.queryByRole("group", { name: "三选一改写" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "再玩一次" })).toBeNull();
    expect(readCollectionProgress(topicIds).completedIds).toEqual(["H03"]);
  }

  it.each([false, true])("再玩一次清空整帖、聚焦并滚回判题，重答无重复提示；减少动态=%s", async (reducedMotion) => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: reducedMotion } as MediaQueryList);
    render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    await answerAndRewrite();
    const before = localStorage.getItem(PROGRESS_KEY);
    fireEvent.click(screen.getByRole("button", { name: "再玩一次" }));
    expectFresh();
    const heading = screen.getByRole("heading", { name: "这条主张，你信吗？" });
    expect(document.activeElement).toBe(heading);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(heading.closest(".task-panel"));
    await answerAndRewrite();
    expect(screen.queryByText(/获得贴纸/)).toBeNull();
    expect(screen.getByText("饭局手记 · 已收藏")).toBeTruthy();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(before);
  });

  it("离开卸载后重进、路由 Activity 隐藏后返回和 bfcache 返回均重置", async () => {
    const props = { topic: publicTopic, topicIds };
    const first = render(<PostExperience {...props} />);
    await answerAndRewrite();
    first.unmount();
    const { rerender } = render(<Activity mode="visible"><PostExperience {...props} /></Activity>);
    expectFresh();
    await answerAndRewrite();
    rerender(<Activity mode="hidden"><PostExperience {...props} /></Activity>);
    rerender(<Activity mode="visible"><PostExperience {...props} /></Activity>);
    expectFresh();
    await answerAndRewrite();
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    expectFresh();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("再玩时取消待完成的 AI 请求，新面板无输入、历史、加载或错误", async () => {
    let askSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (url === "/api/ask") {
        askSignal = init?.signal as AbortSignal;
        return new Promise<Response>(() => {});
      }
      return { ok: true, json: async () => result() } as Response;
    });
    render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    await answerAndRewrite();
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    expect(screen.getByText("值班史官正在查阅资料…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再玩一次" }));
    expect(askSignal?.aborted).toBe(true);
    expectFresh();
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    await screen.findByText("谣言退散");
    expect(screen.getByRole("textbox")).toHaveProperty("value", "");
    expect(screen.getByRole("log", { name: "AI 问答记录" }).textContent).toBe("");
    expect(screen.getByRole("log").getAttribute("aria-busy")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(3);
  });

  it("离开时取消判题，旧请求晚到不写入进度或污染重进题面", async () => {
    let release!: (response: Response) => void;
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_url, init) => {
      signal = init?.signal as AbortSignal;
      return new Promise<Response>((resolve) => { release = resolve; });
    });
    const first = render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
    fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
    first.unmount();
    expect(signal?.aborted).toBe(true);
    render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    await act(async () => release({ ok: true, json: async () => result() } as Response));
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(screen.queryByText("谣言退散")).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("存储写入失败时原地重玩也不重复提示获得贴纸", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    render(<PostExperience topic={publicTopic} topicIds={topicIds} />);
    await answerAndRewrite();
    expect(screen.getByText(/获得贴纸/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再玩一次" }));
    await answerAndRewrite();
    expect(screen.queryByText(/获得贴纸/)).toBeNull();
    expect(screen.getByText("饭局手记 · 已收藏")).toBeTruthy();
  });
});
