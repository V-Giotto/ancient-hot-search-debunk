// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllTopics, getSourcesForTopic, getTopicById } from "@/lib/topics";
import { makeSource, makeTopic } from "./fixtures";

vi.mock("node:fs", () => ({ readFileSync: vi.fn(), readdirSync: vi.fn() }));

const files = new Map<string, string>();

beforeEach(() => {
  files.clear();
  files.set("source-index.json", JSON.stringify([makeSource()]));
  vi.mocked(readdirSync).mockReturnValue([]);
  vi.mocked(readFileSync).mockImplementation((file) => {
    const content = files.get(path.basename(String(file)));
    if (content === undefined) throw new Error("测试文件不存在");
    return content;
  });
});

function setTopicFiles(filenames: string[]) {
  // readdirSync 的最后一个重载使用 Dirent；实际调用未传 withFileTypes，返回字符串。
  vi.mocked(readdirSync).mockReturnValue(filenames as unknown as ReturnType<typeof readdirSync>);
}

describe("本地 JSON 加载器", () => {
  it("空目录返回 []，不存在的 id 返回 undefined", () => {
    expect(getAllTopics()).toEqual([]);
    expect(getTopicById("missing")).toBeUndefined();
  });

  it("读取全部 JSON 并按 rank 排序，忽略 .gitkeep 等文件", () => {
    files.set("first.json", JSON.stringify(makeTopic({ id: "SECOND", rank: 2 })));
    files.set("second.json", JSON.stringify(makeTopic({ id: "FIRST", rank: 1 })));
    setTopicFiles(["first.json", ".gitkeep", "second.json"]);
    expect(getAllTopics().map((topic) => topic.id)).toEqual(["FIRST", "SECOND"]);
    expect(getTopicById("SECOND")?.rank).toBe(2);
    expect(getTopicById("../source-index")).toBeUndefined();
  });

  it("按话题 sourceIds 顺序返回关联来源", () => {
    files.set("source-index.json", JSON.stringify([makeSource(), makeSource({ id: "SECOND" })]));
    const topic = makeTopic({ sourceIds: ["SECOND", "TEST-SOURCE"] });
    expect(getSourcesForTopic(topic).map((source) => source.id)).toEqual(["SECOND", "TEST-SOURCE"]);
  });

  it("关联来源缺失时不静默丢弃", () => {
    expect(() => getSourcesForTopic(makeTopic({ sourceIds: ["MISSING"] }))).toThrow(/sourceId 不存在/);
  });

  it("话题字段校验失败时报告文件名", () => {
    files.set("invalid.json", JSON.stringify(makeTopic({ title: " " })));
    setTopicFiles(["invalid.json"]);
    expect(() => getAllTopics()).toThrow(/话题文件校验失败：invalid.json/);
  });

  it("拒绝语法错误的 JSON 并保留原因", () => {
    files.set("invalid.json", "{broken");
    setTopicFiles(["invalid.json"]);
    expect(() => getAllTopics()).toThrow(/话题文件校验失败/);
    files.set("source-index.json", "{broken");
    expect(() => getAllTopics()).toThrow(/无法读取 JSON/);
  });

  it("来源索引也必须通过 Zod 校验", () => {
    files.set("source-index.json", JSON.stringify([{ id: "incomplete" }]));
    expect(() => getAllTopics()).toThrow();
  });

  it("加载时执行跨文件完整性校验", () => {
    files.set("topic.json", JSON.stringify(makeTopic({ sourceIds: ["MISSING"] })));
    setTopicFiles(["topic.json"]);
    expect(() => getAllTopics()).toThrow(/sourceId 不存在/);
  });
});
