// 服务端 Provider Adapter；不得被客户端组件导入。
export type LlmMessage = { role: "system" | "user"; content: string };
export type LlmFailure = "unconfigured" | "timeout" | "provider";

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

export async function requestJsonCompletion(messages: LlmMessage[]): Promise<unknown> {
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
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.2 }),
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new LlmError("provider");
    const payload = await response.json();
    const content: unknown = payload?.choices?.[0]?.message?.content;
    // 连同提供商可能回显密钥的异常一起隔离，不把上游原文交给日志或客户端。
    if (typeof content !== "string" || content.includes(key)) throw new LlmError("provider");
    return JSON.parse(content) as unknown;
  } catch {
    throw new LlmError(controller.signal.aborted ? "timeout" : "provider");
  } finally {
    clearTimeout(timer);
  }
}
