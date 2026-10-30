import { Activity } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostExperience } from "@/components/post/PostExperience";
import { debates, scenarios, wordingRules } from "@/lib/participation";
import { getAllFeedEntries, getFeedEntryById, toPublicFeedEntry } from "@/lib/feed";
import { getAllTopics, getSourcesForTopic } from "@/lib/topics";
import { COMMENT_CAPACITY, COMMENT_LIMIT, commentStorageKey, parseLocalComments, removeLocalComment, validateComment } from "@/lib/local-comments";
import { readCollectionProgress } from "@/lib/progress";
import constraints from "./fixtures/display-constraints.json";

const topics = getAllTopics();
const topicIds = topics.map(({ id }) => id);
const entry = toPublicFeedEntry(getFeedEntryById("H03")!);
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const { topicId, answer } = JSON.parse(String(init?.body));
    const topic = topics.find(({ id }) => id === topicId)!;
    return Response.json({ isTrue: topic.isTrue, isCorrect: topic.isTrue === answer, reveal: topic.reveal, sources: getSourcesForTopic(topic), rewriteOptions: topic.rewriteOptions });
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function openComposer() { fireEvent.click(screen.getByRole("button", { name: "写本机评论" })); }
function write(text: string) { fireEvent.change(screen.getByRole("textbox", { name: /写本机评论|回复/ }), { target: { value: text } }); }
function save(reply = false) { fireEvent.click(screen.getByRole("button", { name: reply ? "保存回复" : "保存评论" })); }
function chooseAndInspect() {
  fireEvent.click(screen.getByRole("button", { name: scenarios.H03.options[0].text }));
  fireEvent.click(screen.getByRole("button", { name: "找可疑措辞" }));
  fireEvent.click(within(screen.getByLabelText("评论措辞练习")).getByRole("button", { name: "检查措辞：一定" }));
}
async function judge() {
  fireEvent.click(screen.getByRole("radio", { name: "是假的" }));
  fireEvent.click(screen.getByRole("button", { name: "提交判断" }));
  await screen.findByText("谣言退散");
}

describe("Phase 3 参与查证", () => {
  it.each(getAllFeedEntries())("$id 的争论、全部情境反馈与措辞解释没有答案字段或答案关键词", (feed) => {
    const topic = topics.find(({ id }) => id === feed.topicId)!;
    const copy = JSON.stringify({ debate: debates[feed.topicId], scenario: scenarios[feed.topicId], wordingRules });
    expect(debates[feed.topicId]).toBeTruthy();
    expect(copy).not.toMatch(/"(?:isTrue|reveal|sources|sourceIds|rewriteOptions|isBest)"/);
    expect(copy).not.toContain(topic.reveal.correctedClaim);
    for (const word of [...constraints.answerKeywords[feed.topicId as keyof typeof constraints.answerKeywords], ...constraints.hiddenUiWords]) expect(copy).not.toContain(word);
    expect(copy).not.toMatch(new RegExp(constraints.verdictPattern));
  });

  it("情境可改选、有逐项反馈；点选真实正文与评论词语只解释推理，不调用 API 或影响进度", () => {
    const { container } = render(<PostExperience topic={entry} topicIds={topicIds} />);
    for (const option of scenarios.H03.options) {
      fireEvent.click(screen.getByRole("button", { name: option.text }));
      expect(screen.getByText(option.feedback)).toBeTruthy();
      expect(screen.getByRole("button", { name: option.text }).getAttribute("aria-pressed")).toBe("true");
    }
    fireEvent.click(screen.getByRole("button", { name: "找可疑措辞" }));
    const token = container.querySelector<HTMLButtonElement>(".debate-thread .wording-token")!;
    fireEvent.click(token);
    expect(token.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/检查前后说的是不是同一个概念/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "提交判断" })).toHaveProperty("disabled", true);
    expect(readCollectionProgress(topicIds).completedIds).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("争论纠正只随真实判题结果出现，逐字复用已审 correctedClaim 与来源；允许跳过额外互动", async () => {
    render(<PostExperience topic={entry} topicIds={topicIds} />);
    const debate = screen.getByRole("region", { name: "争议回复串" });
    expect(within(debate).queryByText(/看过证据后/)).toBeNull();
    await judge();
    const topic = topics.find(({ id }) => id === "H03")!;
    expect(within(debate).getByText(topic.reveal.correctedClaim)).toBeTruthy();
    expect(within(debate).getAllByRole("link").map((node) => node.getAttribute("href"))).toEqual(getSourcesForTopic(topic).map(({ url }) => url));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/verdict");
  });

  it("重玩、离开重进、Activity 返回与 bfcache 返回均清空情境/措辞/纠正，保留本机评论与收集", async () => {
    const props = { topic: entry, topicIds };
    let view = render(<PostExperience {...props} />);
    openComposer(); write("等我核对配料再说"); save();
    chooseAndInspect();
    openComposer(); write("这条草稿不保存");
    await judge();
    fireEvent.click(screen.getByRole("button", { name: "再玩一次" }));
    function fresh() {
      expect(screen.getByRole("button", { name: "找可疑措辞" }).getAttribute("aria-pressed")).toBe("false");
      expect(within(screen.getByRole("group", { name: "情境选择", hidden: true })).getAllByRole("button", { hidden: true }).every((node) => node.getAttribute("aria-pressed") === "false")).toBe(true);
      expect(screen.queryByText(/看过证据后/)).toBeNull();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByText("这条草稿不保存")).toBeNull();
      expect(screen.getByText("等我核对配料再说")).toBeTruthy();
      expect(readCollectionProgress(topicIds).completedIds).toEqual(["H03"]);
    }
    fresh(); view.unmount();
    view = render(<Activity mode="visible"><PostExperience {...props} /></Activity>); fresh();
    chooseAndInspect();
    view.rerender(<Activity mode="hidden"><PostExperience {...props} /></Activity>);
    view.rerender(<Activity mode="visible"><PostExperience {...props} /></Activity>); fresh();
    chooseAndInspect();
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))); fresh();
  });
});

describe("本机评论与回复", () => {
  it("空白与超长校验；保存、刷新恢复、回复预设评论/预设回复/自己的回复、删除子树；无网络调用", () => {
    let view = render(<PostExperience topic={entry} topicIds={topicIds} />);
    openComposer(); write(" \n "); save();
    expect(screen.getByRole("alert").textContent).toBe("写点内容再保存吧。");
    write("字".repeat(COMMENT_LIMIT + 1)); save();
    expect(screen.getByRole("alert").textContent).toContain("最多 280 字");
    write(" <script>这里按文字显示</script> "); save();
    expect(screen.getByText("<script>这里按文字显示</script>")).toBeTruthy();
    expect(document.querySelector(".local-replies script")).toBeNull();
    let rows = parseLocalComments(localStorage.getItem(commentStorageKey("H03")), []);
    const root = rows[0].id;
    fireEvent.click(screen.getByRole("button", { name: `回复我：${root}` })); write("自己的楼中楼"); save(true);
    const preset = entry.comments[0];
    fireEvent.click(screen.getByRole("button", { name: `回复${preset.author}：${preset.id}` })); write("回复预设评论"); save(true);
    const presetReply = preset.replies![0];
    fireEvent.click(screen.getByRole("button", { name: `回复${presetReply.author}：${presetReply.id}` })); write("回复预设楼中楼"); save(true);
    view.unmount(); view = render(<PostExperience topic={entry} topicIds={topicIds} />);
    expect(screen.getByText("自己的楼中楼")).toBeTruthy();
    expect(screen.getByText("回复预设楼中楼")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "删除自己的评论：<script>这里按文字显示</script>" }));
    expect(screen.queryByText("自己的楼中楼")).toBeNull();
    expect(screen.getByText("回复预设评论")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    view.unmount(); render(<PostExperience topic={toPublicFeedEntry(getFeedEntryById("P05")!)} topicIds={topicIds} />);
    expect(screen.queryByText("回复预设评论")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("存储写入失败不展示保存成功，不丢草稿；恢复后可保存，删除失败保留原记录", () => {
    render(<PostExperience topic={entry} topicIds={topicIds} />);
    openComposer(); write("保留草稿");
    const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    save();
    expect(screen.getByRole("alert").textContent).toContain("草稿已保留");
    expect(screen.getByRole("textbox")).toHaveProperty("value", "保留草稿");
    expect(document.querySelector("[data-local-id]")).toBeNull();
    failure.mockRestore(); save();
    const failingDelete = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    fireEvent.click(screen.getByRole("button", { name: "删除自己的评论：保留草稿" }));
    expect(screen.getByText("保留草稿")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("未能删除");
    failingDelete.mockRestore();
  });

  it("损坏存储安全降级，监听跨标签更新与清除；删除只允许自己的记录", () => {
    localStorage.setItem(commentStorageKey("H03"), "bad json");
    render(<PostExperience topic={entry} topicIds={topicIds} />);
    expect(document.querySelector("[data-local-id]")).toBeNull();
    const item = { id: "local-other-tab", text: "另一个标签保存的", parentId: null, createdAt: new Date().toISOString() };
    act(() => { localStorage.setItem(commentStorageKey("H03"), JSON.stringify({ version: 1, comments: [item] })); window.dispatchEvent(new StorageEvent("storage", { key: commentStorageKey("H03") })); });
    expect(screen.getByText(item.text)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^删除自己的评论/ })).toHaveLength(1);
    act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent("storage", { key: null })); });
    expect(screen.queryByText(item.text)).toBeNull();
  });

  it("达到容量或回复对象被另一标签删除时拒绝保存，保留草稿，不生成悬空回复", () => {
    const comment = { id: "local-parent", text: "回复对象", parentId: null, createdAt: new Date().toISOString() };
    const key = commentStorageKey("H03");
    localStorage.setItem(key, JSON.stringify({ version: 1, comments: [comment] }));
    render(<PostExperience topic={entry} topicIds={topicIds} />);
    fireEvent.click(screen.getByRole("button", { name: "回复我：local-parent" })); write("回复草稿");
    act(() => { localStorage.setItem(key, JSON.stringify({ version: 1, comments: [] })); window.dispatchEvent(new StorageEvent("storage", { key })); });
    save(true);
    expect(screen.getByRole("alert").textContent).toContain("未能保存");
    expect(screen.getByRole("textbox")).toHaveProperty("value", "回复草稿");
    expect(parseLocalComments(localStorage.getItem(key), [])).toEqual([]);
    const full = Array.from({ length: COMMENT_CAPACITY }, (_, i) => ({ ...comment, id: `local-${i}` }));
    act(() => { localStorage.setItem(key, JSON.stringify({ version: 1, comments: full })); window.dispatchEvent(new StorageEvent("storage", { key })); });
    openComposer(); write("容量满了的草稿"); save();
    expect(screen.getByRole("textbox")).toHaveProperty("value", "容量满了的草稿");
    expect(parseLocalComments(localStorage.getItem(key), [])).toHaveLength(COMMENT_CAPACITY);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("拒绝未知版本、坏字段、重复/循环/悬空节点，容量有界，删除不波及其它根评论", () => {
    const comment = { id: "local-a", parentId: null, text: "内容", createdAt: new Date().toISOString() };
    const encode = (comments: unknown[], version = 1) => JSON.stringify({ version, comments });
    expect(validateComment(" ")).toBeTruthy();
    expect(validateComment("字".repeat(COMMENT_LIMIT))).toBeUndefined();
    expect(parseLocalComments(encode([comment], 2), [])).toEqual([]);
    expect(parseLocalComments(encode([comment, comment, { ...comment, id: "local-b", parentId: "missing" }, { ...comment, id: "local-c", parentId: "local-c" }, { ...comment, id: "local-d", text: " " }]), [])).toEqual([comment]);
    expect(parseLocalComments(encode(Array.from({ length: 120 }, (_, i) => ({ ...comment, id: `local-${i}` }))), [])).toHaveLength(COMMENT_CAPACITY);
    const child = { ...comment, id: "local-b", parentId: comment.id };
    const other = { ...comment, id: "local-c" };
    expect(removeLocalComment([comment, child, other], comment.id)).toEqual([other]);
  });
});
