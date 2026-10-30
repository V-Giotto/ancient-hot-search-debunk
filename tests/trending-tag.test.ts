import { describe, expect, it } from "vitest";
import { trendingTag, trendingTagClass } from "../lib/trending-tag";

describe("热搜标签", () => {
  it("8 条时前 2 为爆、中间为热、末 2 为新", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((r) => trendingTag(r, 8))).toEqual(["爆", "爆", "热", "热", "热", "热", "新", "新"]);
  });
  it("12、16 条时仍三种标签齐全且确定", () => {
    for (const n of [12, 16]) {
      const tags = Array.from({ length: n }, (_, i) => trendingTag(i + 1, n));
      expect(new Set(tags)).toEqual(new Set(["爆", "热", "新"]));
      expect(tags[0]).toBe("爆");
      expect(tags[n - 1]).toBe("新");
    }
  });
  it("三种标签颜色各不相同", () => {
    expect(new Set(Object.values(trendingTagClass)).size).toBe(3);
  });
});
