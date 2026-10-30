import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AskPanel } from "@/components/ai/AskPanel";
import sourceIndex from "@/data/source-index.json";
import { SourceSchema } from "@/lib/schemas";

const sources = sourceIndex.filter((source) => source.id.startsWith("S-H03-")).map((source) => SourceSchema.parse(source));
const fetchMock = vi.fn<typeof fetch>();
function reply(overrides = {}) {
  return Response.json({ answer: "这是一条来自 mock Provider 的测试输出。", citedSourceIds: ["S-H03-02"], grounded: true, preview: true, ...overrides });
}
function typeAndSend(question = "测试追问") {
  fireEvent.change(screen.getByRole("textbox", { name: "向值班史官提问" }), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
}

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => reply());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("AskPanel", () => {
  it("初始不请求，空输入禁用发送，显示 500 字限制和 AI 提示", () => {
    render(<AskPanel topicId="H03" sources={sources} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "发送问题" })).toHaveProperty("disabled", true);
    const input = screen.getByRole("textbox");
    expect(input).toHaveProperty("maxLength", 500);
    expect(screen.getByText(/0\/500 字/)).toBeTruthy();
    expect(screen.getByText(/AI 生成，可能有误，以史料为准/)).toBeTruthy();
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "发送问题" })).toHaveProperty("disabled", true);
  });
  it("显示加载状态并禁止重复发送，完成后渲染模型回答、有效引用和预览标记", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<AskPanel topicId="H03" sources={sources} />);
    typeAndSend("  胡椒是什么？  ");
    expect(screen.getByRole("status").textContent).toContain("正在查阅资料");
    expect(screen.getByRole("button", { name: "回答中…" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "胡椒和辣椒是一回事吗？" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(reply({ citedSourceIds: ["S-H03-02", "made-up-999", "S-H03-02"] }));
    expect(await screen.findByText("这是一条来自 mock Provider 的测试输出。")).toBeTruthy();
    expect(screen.getByText("开发预览·资料待审核")).toBeTruthy();
    const citations = screen.getByRole("list", { name: "本条回答引用" });
    const links = within(citations).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toContain(sources[1].title);
    expect(links[0].getAttribute("href")).toBe(sources[1].url);
    expect(links[0].getAttribute("rel")).toContain("noopener");
    expect(screen.queryByText(/made-up-999/)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({ topicId: "H03", question: "胡椒是什么？", history: [] });
  });
  it.each([
    [409, "本条内容审核中，暂不开放追问"],
    [503, "AI 未配置"],
    [504, "AI 回答超时，请重试；你的问题仍然保留。"],
    [502, "AI 服务暂时不可用，请稍后重试。"],
    [429, "提问太快了，请稍后再试。"],
  ])("HTTP %i 显示错误并保留输入，可手动重试", async (status, message) => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "上游内部错误不能直接显示" }, { status: status as number }));
    render(<AskPanel topicId="H03" sources={sources} />);
    typeAndSend("问题仍在");
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(screen.getByRole("textbox")).toHaveProperty("value", "问题仍在");
    expect(screen.getByRole("link", { name: "返回揭晓" }).getAttribute("href")).toBe("#reveal-heading");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "重试提问" }));
    await screen.findByText("这是一条来自 mock Provider 的测试输出。");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]!.body).toBe(fetchMock.mock.calls[1][1]!.body);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each([409, 503])("HTTP %i 可返回揭晓并聚焦，问题和错误提示仍保留", async (status) => {
    fetchMock.mockResolvedValueOnce(Response.json({}, { status }));
    render(<><h2 id="reveal-heading" tabIndex={-1}>测试揭晓</h2><AskPanel topicId="H03" sources={sources} /></>);
    typeAndSend("返回后仍可重试");
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("link", { name: "返回揭晓" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "测试揭晓" }));
    expect(screen.getByRole("textbox")).toHaveProperty("value", "返回后仍可重试");
    expect(screen.getByRole("button", { name: "重试提问" })).toHaveProperty("disabled", false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("网络失败和非法响应可重试，输入不会丢失", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fetchMock.mockResolvedValueOnce(Response.json({ wrong: "结构错误" }));
    render(<AskPanel topicId="H03" sources={sources} />);
    typeAndSend("保留问题");
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox")).toHaveProperty("value", "保留问题");
    fireEvent.click(screen.getByRole("button", { name: "重试提问" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByRole("textbox")).toHaveProperty("value", "保留问题");
    fireEvent.click(screen.getByRole("button", { name: "重试提问" }));
    await screen.findByText("这是一条来自 mock Provider 的测试输出。");
  });
  it.each([
    "唐朝人到底用什么调料获得辛辣味？",
    "胡椒和辣椒是一回事吗？",
    "你凭什么说辣椒是明代才传入？",
  ])("预设按钮直接向 /api/ask 发起真实组件请求：%s", async (question) => {
    render(<AskPanel topicId="H03" sources={sources} />);
    fireEvent.click(screen.getByRole("button", { name: question }));
    await screen.findByText("这是一条来自 mock Provider 的测试输出。");
    expect(fetchMock).toHaveBeenCalledWith("/api/ask", expect.objectContaining({ method: "POST", body: JSON.stringify({ topicId: "H03", question, history: [] }) }));
  });
  it("后续请求只附最近 6 条成功对话，每条回答历史截到 1000 字", async () => {
    fetchMock.mockImplementation(async () => reply({ answer: "答".repeat(1500), preview: undefined }));
    render(<AskPanel topicId="H03" sources={sources} />);
    for (let i = 0; i < 5; i++) {
      typeAndSend(`第${i}问`);
      await waitFor(() => expect(screen.getByRole("textbox")).toHaveProperty("value", ""));
    }
    const last = JSON.parse(String(fetchMock.mock.calls[4][1]!.body));
    expect(last.history).toHaveLength(6);
    expect(last.history[0]).toEqual({ role: "user", content: "第1问" });
    expect(last.history[1]).toEqual({ role: "assistant", content: "答".repeat(1000) });
    expect(screen.queryByText("开发预览·资料待审核")).toBeNull();
  });
  it("即使响应引用 rejected 或未知来源，也不显示链接；答案作为文本渲染", async () => {
    fetchMock.mockResolvedValue(reply({ answer: "<script>alert('test')</script>", citedSourceIds: ["S-H03-02", "made-up-999"] }));
    const { container } = render(<AskPanel topicId="H03" sources={sources.map((s) => ({ ...s, status: "rejected" }))} />);
    typeAndSend();
    await screen.findByText("<script>alert('test')</script>");
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
  it("离开页面时取消进行中的请求", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<AskPanel topicId="H03" sources={sources} />);
    typeAndSend();
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
