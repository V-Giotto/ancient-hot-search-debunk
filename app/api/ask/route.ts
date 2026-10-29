import { AskRequestSchema, ModelAnswerSchema } from "@/lib/ask-contract";
import { buildAskMessages } from "@/lib/ask-context";
import { checkAskRateLimit } from "@/lib/ask-rate-limit";
import { hasAiKey, LlmError, requestJsonCompletion } from "@/lib/llm";
import { validateSourceIds } from "@/lib/source-guard";
import { getSourcesForTopic, getTopicById } from "@/lib/topics";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

function failure(status: number, error: string, extraHeaders?: Record<string, string>) {
  return Response.json({ error }, { status, headers: { ...headers, ...extraHeaders } });
}

export async function POST(request: Request) {
  let body;
  try {
    body = AskRequestSchema.parse(await request.json());
  } catch {
    return failure(400, "请提供话题 ID、1–500 字的问题；对话历史最多 6 条，每条需为 user/assistant 且内容为 1–1000 字。");
  }

  const topic = getTopicById(body.topicId);
  if (!topic) return failure(404, "未找到这条热搜");
  const preview = process.env.CONTENT_MODE === "preview";
  if (topic.reviewStatus === "rejected" || (!preview && topic.reviewStatus !== "reviewed")) {
    return failure(409, "本条资料尚在审核，暂不开放 AI 科普");
  }
  if (!hasAiKey()) return failure(503, "实时 AI 尚未配置；你仍可查看史实与来源");

  // 部署时须由可信代理覆盖这些头；直连开发服务共用 unknown 桶。
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim() || "unknown";
  const limit = checkAskRateLimit(ip);
  if (!limit.allowed) return failure(429, "提问太快了，请稍后再试。", { "Retry-After": String(limit.retryAfter) });

  const sources = getSourcesForTopic(topic).filter((source) => source.status === "reviewed" || (preview && source.status === "pending"));
  const messages = buildAskMessages(topic, sources, preview, body.question, body.history);
  try {
    const result = ModelAnswerSchema.parse(await requestJsonCompletion(messages));
    const citedSourceIds = validateSourceIds(result.citedSourceIds, sources.map((source) => source.id));
    return Response.json({
      answer: result.answer,
      citedSourceIds,
      grounded: result.grounded && citedSourceIds.length > 0,
      ...(preview ? { preview: true } : {}),
    }, { headers });
  } catch (error) {
    if (error instanceof LlmError && error.kind === "unconfigured") return failure(503, "实时 AI 尚未配置；你仍可查看史实与来源");
    if (error instanceof LlmError && error.kind === "timeout") return failure(504, "AI 回答超时，请重试；你的问题仍然保留。");
    return failure(502, "AI 服务暂时不可用或返回格式有误，请稍后重试。");
  }
}
