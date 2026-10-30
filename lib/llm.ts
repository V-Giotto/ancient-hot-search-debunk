// 服务端 Provider Adapter；不得被客户端组件导入。
export type LlmMessage = { role: "system" | "user"; content: string };
export type LlmFailure = "unconfigured" | "timeout" | "provider" | "truncated" | "invalid_json" | "empty";

export class LlmError extends Error {
  constructor(public readonly kind: LlmFailure) {
    // 不保留第三方错误、响应 body、请求或密钥，避免被框架日志意外记录。
    super(`AI ${kind}`);
    this.name = "LlmError";
  }
}

export function hasAiKey(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

export async function requestJsonCompletion(messages: LlmMessage[], options: { maxTokens?: number; allowPlainTextReply?: boolean } = {}): Promise<unknown> {
  const key = process.env.AI_API_KEY?.trim();
  if (!key) throw new LlmError("unconfigured");
  const base = (process.env.AI_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || "deepseek-flash";
  const configuredTimeout = Number(process.env.AI_TIMEOUT_MS || 20000);
  const timeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 && configuredTimeout <= 2147483647
    ? configuredTimeout : 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.2,
        ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }) }),
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new LlmError("provider");
    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const content: unknown = choice?.message?.content;
    // 连同提供商可能回显密钥的异常一起隔离，不把上游原文交给日志或客户端。
    if (typeof content === "string" && content.includes(key)) throw new LlmError("provider");
    if (choice?.finish_reason === "length") throw new LlmError("truncated");
    if (content === null || (typeof content === "string" && !content.trim())) throw new LlmError("empty");
    if (typeof content !== "string") throw new LlmError("provider");
    // 真实上游有时忽略 JSON 模式。只有好友接口允许将完整纯文本归一为 reply；
    // JSON 外形的损坏内容和被 token 截断的内容必须交给调用方重试，不能伪装成正常文本。
    const jsonText = options.allowPlainTextReply
      ? content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1") : content;
    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); }
    catch {
      if (!options.allowPlainTextReply || /^[{["`]/.test(jsonText.trim())) throw new LlmError("invalid_json");
      parsed = { reply: content.trim() };
    }
    // 同时检查 JSON 解码后的文本，阻止上游用 Unicode 转义回显密钥。
    if (JSON.stringify(parsed).includes(key)) throw new LlmError("provider");
    return parsed;
  } catch (error) {
    if (controller.signal.aborted) throw new LlmError("timeout");
    if (error instanceof LlmError) throw error;
    throw new LlmError("provider");
  } finally {
    clearTimeout(timer);
  }
}
