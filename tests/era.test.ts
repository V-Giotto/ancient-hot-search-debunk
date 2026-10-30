// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EraSchema, isLaterEra } from "@/lib/era";
import { getAllTopics, validateContentSet } from "@/lib/topics";
import { makeSource, makeTopic } from "./fixtures";

const eras = [
  { label: "春秋", order: 1 }, { label: "战国", order: 2 }, { label: "汉", order: 3 },
  { label: "唐代", order: 4 }, { label: "北宋", order: 5 },
] as const;

describe("结构化时代与先后比较", () => {
  it("春秋 < 战国 < 汉 < 唐代 < 北宋，同代与更早均不算晚代", () => {
    for (const [topicIndex, topicEra] of eras.entries()) {
      expect(EraSchema.parse(topicEra)).toEqual(topicEra);
      for (const [friendIndex, friendEra] of eras.entries()) {
        expect(isLaterEra(topicEra, friendEra)).toBe(topicIndex > friendIndex);
      }
    }
  });
  it.each([
    undefined, null, "唐代", {}, { label: "宋代", order: 5 }, { label: "唐代" },
    { order: 4 }, { label: "唐代", order: 0 }, { label: "唐代", order: -1 },
    { label: "唐代", order: 4.5 }, { label: "唐代", order: "4" }, { label: "唐代", order: 5 },
    { label: "唐代", order: 4, birthYear: 1 },
  ])("内容校验拒绝缺失、未知、错序或多余的时代字段（%#）", (era) => {
    expect(EraSchema.safeParse(era).success).toBe(false);
    expect(() => validateContentSet([{ ...makeTopic(), era }], [makeSource()])).toThrow();
  });
  it("十二题沿用指定已审时代标签，H07 依据宋代以前的蹴鞠记载归于战国", () => {
    expect(getAllTopics().map(({ id, era }) => [id, era])).toEqual([
      ["H01", eras[3]], ["H02", eras[4]], ["H03", eras[3]], ["H04", eras[4]],
      ["H05", eras[3]], ["H06", eras[1]], ["H07", eras[1]], ["H08", eras[3]],
      ["H09", eras[4]], ["H10", eras[4]], ["H11", eras[0]], ["H12", eras[1]],
    ]);
  });
});
