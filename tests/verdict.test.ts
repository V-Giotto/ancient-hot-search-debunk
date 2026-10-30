// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getAllTopics, getTopicById } from "@/lib/topics";
import { toPublicTopic } from "@/lib/public-topic";
import { judgeAnswer } from "@/lib/verdict";

describe("judgeAnswer：只以服务端真值判题", () => {
  it.each([true, false])("真题，选择 %s", (answer) => {
    expect(judgeAnswer({ isTrue: true }, answer)).toEqual({ isTrue: true, isCorrect: answer });
  });

  it.each([true, false])("真实 H03，选择 %s", (answer) => {
    expect(judgeAnswer(getTopicById("H03")!, answer)).toEqual({ isTrue: false, isCorrect: !answer });
  });

  it.each(getAllTopics())("$id 初始客户端题面显式排除答案、来源、改写与事实卡", (topic) => {
    const safe = toPublicTopic(topic);
    const serialized = JSON.stringify(safe);
    for (const field of ["isTrue", "reveal", "sourceIds", "sources", "rewriteOptions", "isBest", "feedback", "aiFacts", "aiLimitations"]) {
      expect(serialized).not.toContain(`"${field}"`);
    }
    expect(safe.claim).toBe(topic.claim);
  });
});
