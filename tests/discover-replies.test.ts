import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "data/topics");
const topics = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

function replies(t: any): any[] {
  const out: any[] = [];
  for (const c of t.comments ?? []) for (const r of c.replies ?? []) out.push(r);
  return out;
}

describe("发现模块作者回复", () => {
  it("每个发现题都有作者回复，且回复文案跨题不重复", () => {
    const seen = new Map<string, string>();
    const discover = topics.filter((t) => t.module === "discover");
    expect(discover).toHaveLength(7);
    for (const t of discover) {
      const own = replies(t).filter((r) => r.author === t.author.name);
      expect(own.length, t.id).toBeGreaterThan(0);
      for (const r of replies(t)) {
        const prev = seen.get(r.text);
        expect(prev, `${t.id} 与 ${prev} 重复：${r.text}`).toBeUndefined();
        seen.set(r.text, t.id);
      }
    }
  });
});
