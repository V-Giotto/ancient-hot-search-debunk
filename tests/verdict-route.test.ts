// @vitest-environment node
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/verdict/route";

function request(body: unknown) {
  return new Request("http://localhost/api/verdict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/verdict（真实 H01–H08 数据）", () => {
  it("未知 id 返回 404", async () => {
    expect((await POST(request({ topicId: "MISSING", answer: false }))).status).toBe(404);
  });

  it.each([null, [], {}, { topicId: "H03" }, { topicId: "H03", answer: "false" }, { topicId: "H03", answer: 0 }, { topicId: "", answer: false }, { topicId: "H03", answer: true, isTrue: true }])("非法 body 返回 400：%j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
  });

  it("非 JSON 请求返回 400", async () => {
    const response = await POST(new Request("http://localhost/api/verdict", { method: "POST", body: "{broken" }));
    expect(response.status).toBe(400);
  });

  it.each([
    { topicId: "H01", isTrue: false, best: "A", sourceCount: 2, corrected: "李白与杜甫在唐代相识并有交游记载；现代互关说法只是创作。" },
    { topicId: "H02", isTrue: true, best: "C", sourceCount: 3, corrected: "宋代部分城市已有购买现成饭食、代买送食等服务，与现代外卖平台不同。" },
    { topicId: "H03", isTrue: false, best: "C", sourceCount: 3, corrected: "唐代有胡椒、花椒等辛香料，但来自美洲的辣椒约在明末传入中国。" },
    { topicId: "H04", isTrue: true, best: "B", sourceCount: 3, corrected: "北宋四川出现交子，并经历民间使用到官府发行的发展过程。" },
    { topicId: "H05", isTrue: false, best: "B", sourceCount: 2, corrected: "唐三彩是多种釉色的唐代彩釉陶器，并非严格只有三种颜色。" },
    { topicId: "H06", isTrue: true, best: "A", sourceCount: 2, corrected: "战国已有可借助冰块冷却酒饮的冰鉴等器具，不等于电冰箱。" },
    { topicId: "H07", isTrue: false, best: "C", sourceCount: 2, corrected: "蹴鞠在宋代以前已有记载，宋代进一步发展，不能说起源于宋代。" },
    { topicId: "H08", isTrue: true, best: "B", sourceCount: 2, corrected: "唐代遗址发现带植毛孔的牙刷柄，可证明当时已有这种器具。" },
  ].flatMap((scenario) => [false, true].map((answer) => ({ ...scenario, answer }))))("$topicId 提交 $answer 后返回本题揭晓与改写，不缓存", async ({ topicId, isTrue, best, sourceCount, corrected, answer }) => {
    const response = await POST(request({ topicId, answer }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const result = await response.json();
    expect(result.isTrue).toBe(isTrue);
    expect(result.isCorrect).toBe(answer === isTrue);
    expect(result.reveal.correctedClaim).toBe(corrected);
    expect(result.sources).toHaveLength(sourceCount);
    expect(result.sources.every((source: { id: string; status: string }) => source.status === "pending" && source.id.startsWith(`S-${topicId}-`))).toBe(true);
    expect(result.rewriteOptions.find((option: { isBest: boolean }) => option.isBest).id).toBe(best);
    expect(result).not.toHaveProperty("aiFacts");
  });
});
