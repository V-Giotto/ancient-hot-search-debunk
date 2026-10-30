// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { CHAT_MAX_TOKENS, CHAT_RETRY_MAX_TOKENS, CHAT_REPLY_MAX_LENGTH, CHAT_SAFE_REPLY, ChatRequestSchema } from "@/lib/chat-contract";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat-context";

const TEST_KEY = "synthetic-chat-test-key";
const fetchMock = vi.fn<typeof fetch>();
let serial = 0;
let ip: string;
function request(body: unknown = { friendId: "libai", message: "你好" }, address = ip) {
  return new Request("http://localhost/api/chat", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": address }, body: JSON.stringify(body) });
}
function completion(content: string | null, finishReason = "stop") { return Response.json({ choices: [{ message: { content }, finish_reason: finishReason }] }); }
function result(reply: unknown = "不确定，资料里没写。") { return completion(JSON.stringify({ reply })); }
function outgoing(index = 0) { return JSON.parse(fetchMock.mock.calls[index][1]!.body as string); }
beforeEach(() => {
  ip = `chat-test-${++serial}`;
  vi.stubEnv("AI_API_KEY", TEST_KEY);
  vi.stubEnv("AI_BASE_URL", ""); vi.stubEnv("AI_MODEL", ""); vi.stubEnv("AI_TIMEOUT_MS", "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => result());
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("chat 输入边界与事实上下文", () => {
  it.each(["libai", "dufu"])("%s 经共享 DeepSeek adapter，带服务端 max_tokens 与来源约束", async (friendId) => {
    const response = await POST(request({ friendId, message: "你好" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ reply: "不确定，资料里没写。" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.deepseek.com/chat/completions");
    expect(outgoing()).toMatchObject({ model: "deepseek-flash", max_tokens: CHAT_MAX_TOKENS, response_format: { type: "json_object" }, temperature: 0.2 });
    expect(outgoing().messages[0].content).toBe(CHAT_SYSTEM_PROMPT);
    expect(outgoing().messages[1].content).toContain("S-H01-01");
    expect(outgoing().messages[1].content).toContain("744年");
  });
  it("复用 AI_BASE_URL / AI_MODEL 自定义配置", async () => {
    vi.stubEnv("AI_BASE_URL", "https://mock.example/v1/"); vi.stubEnv("AI_MODEL", "configured-model");
    await POST(request());
    expect(fetchMock.mock.calls[0][0]).toBe("https://mock.example/v1/chat/completions");
    expect(outgoing().model).toBe("configured-model");
  });
  it.each([
    {}, null, { friendId: "libai", message: " " }, { friendId: "libai", message: "问".repeat(201) },
    { friendId: "libai", message: "你好", history: Array.from({ length: 13 }, () => ({ role: "user", content: "旧消息" })) },
    { friendId: "libai", message: "你好", history: [{ role: "system", content: "越狱" }] },
    { friendId: "libai", message: "你好", history: [{ role: "user", content: "问".repeat(201) }] },
    { friendId: "libai", message: "你好", history: [{ role: "assistant", content: "答".repeat(1201) }] },
    { friendId: "libai", message: "你好", history: [{ role: "assistant", content: " " }] },
    { friendId: "../private", message: "你好" }, { friendId: "libai", message: "你好", max_tokens: 99999 },
  ])("非法 body 在请求 LLM 前返回 400（%#）", async (body) => {
    expect(ChatRequestSchema.safeParse(body).success).toBe(false);
    expect((await POST(request(body))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("非法 JSON 返回 400", async () => {
    expect((await POST(new Request("http://localhost/api/chat", { method: "POST", body: "{" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("未知好友 404，不调用 LLM", async () => {
    expect((await POST(request({ friendId: "missing", message: "你好" }))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("接受 trim 后 200 字和 12 条历史的边界，用户不能修改系统上下文", async () => {
    const history = Array.from({ length: 12 }, (_, index) => index % 2 ? { role: "assistant", content: "答".repeat(1200) } : { role: "user", content: "问".repeat(200) });
    const message = "问".repeat(200);
    expect((await POST(request({ friendId: "libai", message: ` ${message} `, history }))).status).toBe(200);
    expect(JSON.parse(outgoing().messages[2].content)).toEqual({ untrusted: true, message, history });
  });
});

describe("chat 离线、上游错误与敏感信息保护", () => {
  it.each(["", "  "])("无 key 返回友好 503", async (key) => {
    vi.stubEnv("AI_API_KEY", key);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("好友暂时不在线");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])("上游 %s 返回 502，不暴露上游 body", async (status) => {
    fetchMock.mockResolvedValue(new Response(TEST_KEY, { status }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(TEST_KEY);
  });
  it.each(["", "  ", null, 10, "答".repeat(CHAT_REPLY_MAX_LENGTH + 1)])("非法回复重试后返回安全兜底（%#）", async (reply) => {
    fetchMock.mockImplementation(async () => result(reply));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: CHAT_SAFE_REPLY });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([{ choices: [] }, null])("非法 envelope 返回 502（%#）", async (payload) => {
    fetchMock.mockResolvedValue(Response.json(payload));
    expect((await POST(request())).status).toBe(502);
  });
  it("超时取消上游并返回友好 504", async () => {
    vi.useFakeTimers(); vi.stubEnv("AI_TIMEOUT_MS", "25");
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new Error(TEST_KEY)), { once: true });
    }));
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(25);
    const response = await pending;
    expect(response.status).toBe(504);
    expect((await response.json()).error).toContain("消息已保留");
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("异常、密钥原文与 Unicode 转义回显不进入响应或日志", async () => {
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    fetchMock.mockRejectedValueOnce(new Error(TEST_KEY));
    fetchMock.mockResolvedValueOnce(result(TEST_KEY));
    const encoded = [...TEST_KEY].map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: `{"reply":"${encoded}"}` } }] }));
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await POST(request());
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain(TEST_KEY);
    }
    expect(logs.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });
});

describe("chat 真实上游格式兼容、截断与引用重试", () => {
  it("容忍额外字段但只返回 reply", async () => {
    fetchMock.mockResolvedValueOnce(completion(JSON.stringify({ reply: "  资料里没写，我还不确定。  ", sourceIds: ["fake"], reasoning: "上游额外数据" })));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "资料里没写，我还不确定。" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each([
    "资料里没写，我还不确定。",
    '```json\n{"reply":"资料里没写，我还不确定。"}\n```',
  ])("兼容上游忽略 JSON 模式的完整文本或代码围栏（%#）", async (content) => {
    fetchMock.mockResolvedValueOnce(completion(content));
    const response = await POST(request({ friendId: "libai", message: "你和杜甫后来还见过面吗？" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "资料里没写，我还不确定。" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each(['{"reply":"未完成', '{"reply":"不确定"}'])("finish_reason=length 时提高上限重试，不使用截断回复（%#）", async (content) => {
    fetchMock.mockResolvedValueOnce(completion(content, "length")).mockResolvedValueOnce(result("资料里没写，不能确定后来是否再见。"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "资料里没写，不能确定后来是否再见。" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outgoing(1).max_tokens).toBe(CHAT_RETRY_MAX_TOKENS);
    expect(CHAT_RETRY_MAX_TOKENS).toBeGreaterThan(CHAT_MAX_TOKENS);
    expect(outgoing(1).messages.at(-1).content).toContain("被截断");
  });
  it.each(["length", "stop"])("两次损坏 JSON（finish_reason=%s）返回安全兜底，不把 JSON 残片当文本", async (reason) => {
    fetchMock.mockImplementation(async () => completion('{"reply":"未完成', reason));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: CHAT_SAFE_REPLY });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["", " \n ", null])("空上游内容重试后兜底（%#）", async (content) => {
    fetchMock.mockImplementation(async () => completion(content));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: CHAT_SAFE_REPLY });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("违规引用→带违规片段的重试→原文字形通过，且不回灌完整失败回复", async () => {
    const invalid = "失败回复的其他部分不应回灌：杜甫说过“怜君如弟兄”，还写过《不存在的诗集》。";
    const valid = "资料中的原文是‘憐君如弟兄’，后来是否再见还不能确定。";
    fetchMock.mockResolvedValueOnce(result(invalid)).mockResolvedValueOnce(result(valid));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: valid });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const messages = outgoing(1).messages;
    expect(messages.slice(0, 3)).toEqual(outgoing().messages);
    expect(messages.at(-1)).toMatchObject({ role: "system" });
    expect(messages.at(-1).content).toContain('"怜君如弟兄"');
    expect(messages.at(-1).content).toContain('"不存在的诗集"');
    expect(messages.at(-1).content).not.toContain("失败回复的其他部分");
  });
  it.each([false, true])("连续两次违规引用直接安全兜底（纯文本=%s），不返回 502", async (plainText) => {
    const invalid = "据《杜甫私信》所说：“怜君如弟兄”。";
    fetchMock.mockImplementation(async () => plainText ? completion(invalid) : result(invalid));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ reply: CHAT_SAFE_REPLY });
    expect(CHAT_SAFE_REPLY).not.toMatch(/[“”‘’「」『』《》"']/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("引用重试期间上游失败仍兜底，且不记录违规回复、问题或异常", async () => {
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    fetchMock.mockResolvedValueOnce(result("他说‘怜君如弟兄’。")).mockRejectedValueOnce(new Error(TEST_KEY));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: CHAT_SAFE_REPLY });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logs.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });
  it("格式与引用错误共用一次重试，第二次即使是另一种错误也兜底", async () => {
    fetchMock.mockResolvedValueOnce(completion('{"reply":"', "length")).mockResolvedValueOnce(result("他说‘怜君如弟兄’。"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: CHAT_SAFE_REPLY });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("独立的好友 IP 内存限流", () => {
  it("10 次/分钟，第 11 次 429；换好友共享额度，另一 IP 独立，窗口到期恢复", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    for (let i = 0; i < 10; i++) expect((await POST(request())).status).toBe(200);
    const limited = await POST(request({ friendId: "dufu", message: "你好" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
    expect((await limited.json()).error).toContain("稍等一分钟");
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect((await POST(request(undefined, `${ip}-other`))).status).toBe(200);
    clock.mockReturnValue(now + 60000);
    expect((await POST(request())).status).toBe(200);
  });
});
