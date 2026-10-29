import { z } from "zod";
import { getSourcesForTopic, getTopicById } from "@/lib/topics";
import { judgeAnswer, type VerdictResult } from "@/lib/verdict";

export const runtime = "nodejs";

const BodySchema = z.strictObject({ topicId: z.string().trim().min(1), answer: z.boolean() });
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "请提供 topicId 和布尔值 answer。" }, { status: 400, headers });
  }

  const topic = getTopicById(body.topicId);
  if (!topic) return Response.json({ error: "这条热搜暂未找到。" }, { status: 404, headers });

  const result: VerdictResult = {
    ...judgeAnswer(topic, body.answer),
    reveal: topic.reveal,
    sources: getSourcesForTopic(topic),
    rewriteOptions: topic.rewriteOptions,
  };
  return Response.json(result, { headers });
}
