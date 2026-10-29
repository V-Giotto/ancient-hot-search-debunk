// @vitest-environment node
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/verdict/route";

function request(body: unknown) {
  return new Request("http://localhost/api/verdict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/verdict（真实 H03 数据）", () => {
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

  it.each([false, true])("正常提交 %s 后才返回全部揭晓数据，不缓存", async (answer) => {
    const response = await POST(request({ topicId: "H03", answer }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const result = await response.json();
    expect(result.isTrue).toBe(false);
    expect(result.isCorrect).toBe(!answer);
    expect(result.reveal.correctedClaim).toBe("唐代有胡椒、花椒等辛香料，但来自美洲的辣椒约在明末传入中国。");
    expect(result.sources).toHaveLength(3);
    expect(result.sources.every((source: { status: string }) => source.status === "pending")).toBe(true);
    expect(result.rewriteOptions.find((option: { isBest: boolean }) => option.isBest).id).toBe("C");
    expect(result).not.toHaveProperty("aiFacts");
  });
});
