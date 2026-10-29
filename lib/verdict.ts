import type { HotTopic, Source } from "./schemas";

export function judgeAnswer(topic: Pick<HotTopic, "isTrue">, answer: boolean) {
  return { isTrue: topic.isTrue, isCorrect: answer === topic.isTrue };
}

export type VerdictResult = ReturnType<typeof judgeAnswer> & {
  reveal: HotTopic["reveal"];
  sources: Source[];
  rewriteOptions: HotTopic["rewriteOptions"];
};
