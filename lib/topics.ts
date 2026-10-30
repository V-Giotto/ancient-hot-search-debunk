// 仅供服务端页面和 Node 测试使用；不向客户端传递整份含答案的数据。
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { HotTopicSchema, SourceSchema, type HotTopic, type Source } from "./schemas";

type ContentSetOptions = { expectedCount?: number };

/**
 * 校验失败时抛出带字段路径的 ZodError 或带话题 ID 的完整性错误。
 * 默认按当前题目数量校验连续排名；8/12/16 条阶段均检查真假均衡。
 * pending/rejected 是合法审核状态；本模块不将其自动升级为 reviewed。
 */
export function validateContentSet(
  topics: unknown,
  sources: unknown,
  { expectedCount }: ContentSetOptions = {},
): void {
  const parsedTopics = z.array(HotTopicSchema).parse(topics);
  const parsedSources = z.array(SourceSchema).parse(sources);
  const requiredCount = z.number().int().nonnegative().parse(expectedCount ?? parsedTopics.length);
  const errors: string[] = [];

  if (parsedTopics.length !== requiredCount) {
    errors.push(`题目数量应为 ${requiredCount}，实际为 ${parsedTopics.length}`);
  }

  const topicIds = new Set<string>();
  const ranks = new Set<number>();
  const sourceIds = new Set<string>();

  for (const source of parsedSources) {
    if (sourceIds.has(source.id)) errors.push(`来源 id 重复：${source.id}`);
    sourceIds.add(source.id);
  }

  for (const topic of parsedTopics) {
    if (topicIds.has(topic.id)) errors.push(`话题 id 重复：${topic.id}`);
    if (ranks.has(topic.rank)) errors.push(`rank 重复：${topic.rank}`);
    topicIds.add(topic.id);
    ranks.add(topic.rank);

    for (const comment of topic.comments) {
      const replyIds = new Set([comment.id]);
      for (const reply of comment.replies ?? []) {
        if (replyIds.has(reply.id) || !replyIds.has(reply.replyTo)) {
          errors.push(`${topic.id} 的回复线程必须使用唯一 id 并指向本线程已存在的评论或回复`);
        }
        replyIds.add(reply.id);
      }
    }

    for (const sourceId of topic.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`${topic.id} 的 sourceId 不存在：${sourceId}`);
    }
  }

  for (let rank = 1; rank <= parsedTopics.length; rank += 1) {
    if (!ranks.has(rank)) errors.push(`rank 必须从 1 连续排列，缺少 ${rank}`);
  }

  if (expectedCount !== undefined && [8, 12, 16].includes(expectedCount)) {
    const trueCount = parsedTopics.filter((topic) => topic.isTrue).length;
    const falseCount = parsedTopics.length - trueCount;
    const half = expectedCount / 2;
    if (trueCount !== half || falseCount !== half) {
      errors.push(`真假比例必须为 ${half}:${half}，实际为 ${trueCount}:${falseCount}`);
    }
  }

  if (errors.length > 0) throw new Error(`内容完整性校验失败：\n${errors.join("\n")}`);
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (cause) {
    throw new Error(`无法读取 JSON：${filePath}`, { cause });
  }
}

function loadContentSet(): { topics: HotTopic[]; sources: Source[] } {
  const dataDirectory = path.join(process.cwd(), "data");
  const topicsDirectory = path.join(dataDirectory, "topics");
  const sources = z.array(SourceSchema).parse(readJson(path.join(dataDirectory, "source-index.json")));
  const topics = readdirSync(topicsDirectory)
    .filter((filename) => filename.endsWith(".json"))
    .sort()
    .map((filename) => {
      try {
        return HotTopicSchema.parse(readJson(path.join(topicsDirectory, filename)));
      } catch (cause) {
        throw new Error(`话题文件校验失败：${filename}`, { cause });
      }
    });

  validateContentSet(topics, sources, { expectedCount: topics.length });
  return { topics: topics.sort((a, b) => a.rank - b.rank), sources };
}

export function getAllTopics(): HotTopic[] {
  return loadContentSet().topics;
}

export function getTopicById(id: string): HotTopic | undefined {
  return getAllTopics().find((topic) => topic.id === id);
}

export function getSourcesForTopic(topic: HotTopic): Source[] {
  const sourcesById = new Map(loadContentSet().sources.map((source) => [source.id, source]));
  return topic.sourceIds.map((sourceId) => {
    const source = sourcesById.get(sourceId);
    if (!source) throw new Error(`${topic.id} 的 sourceId 不存在：${sourceId}`);
    return source;
  });
}
