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
    { label: "春秋战国", order: 2 },
  ])("内容校验拒绝缺失、未知、错序或多余的时代字段（%#）", (era) => {
    expect(EraSchema.safeParse(era).success).toBe(false);
    expect(() => validateContentSet([{ ...makeTopic(), era }], [makeSource()])).toThrow();
  });
  it("十二题按核心主张标注，H07 战国，H12 春秋战国取春秋序号", () => {
    expect(getAllTopics().map(({ id, era }) => [id, era])).toEqual([
      ["H01", eras[3]], ["H02", eras[4]], ["H03", eras[3]], ["H04", eras[4]],
      ["H05", eras[3]], ["H06", eras[1]], ["H07", eras[1]], ["H08", eras[3]],
      ["H09", eras[4]], ["H10", eras[4]], ["H11", eras[0]], ["H12", { label: "春秋战国", order: 1 }],
    ]);
  });
  it("跨时代取最早时期序号，春秋战国早于唐，北宋晚于唐", () => {
    const across = EraSchema.parse({ label: "春秋战国", order: 1 });
    expect(isLaterEra(across, eras[3])).toBe(false);
    expect(isLaterEra(across, eras[0])).toBe(false);
    expect(isLaterEra(eras[4], eras[3])).toBe(true);
  });
  it("仅 H07、H12 的年代经 Giotto 审核，原题目 reviewStatus 不变", () => {
    for (const topic of getAllTopics()) {
      expect(topic.reviewStatus).toBe("reviewed");
      expect(topic.eraReview).toEqual(["H07", "H12"].includes(topic.id)
        ? { status: "reviewed", by: "Giotto", at: "2026-10-30T07:32:00-07:00" }
        : { status: "pending" });
    }
  });
  it("H07、H12 分开记录传言、核心背景与证据时间", () => {
    const topics = getAllTopics();
    expect(topics.find(({ id }) => id === "H07")).toMatchObject({
      era: { label: "战国", order: 2 }, rumorEra: "宋代",
      coreContext: "战国齐国临淄", evidenceEra: "后世文献记载战国史事",
    });
    expect(topics.find(({ id }) => id === "H12")).toMatchObject({
      era: { label: "春秋战国", order: 1 }, rumorEra: "不限定",
      coreContext: "春秋孙武、战国孙膑", evidenceEra: "西汉竹简、1972年出土",
    });
  });
  it.each(["rumorEra", "coreContext", "evidenceEra", "eraReview"])("拒绝缺失或损坏的年代元数据 %s", (field) => {
    for (const value of [undefined, null, "", " ", 1, {}]) {
      expect(() => validateContentSet([{ ...makeTopic(), [field]: value }], [makeSource()])).toThrow();
    }
  });
  it.each([
    { status: "rejected" }, { status: "pending", by: " " },
    { status: "reviewed", at: "2026-10-30" }, { status: "pending", extra: true },
  ])("拒绝非法年代审核记录 %j", (eraReview) => {
    expect(() => validateContentSet([{ ...makeTopic(), eraReview }], [makeSource()])).toThrow();
  });
});
