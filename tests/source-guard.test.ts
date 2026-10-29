import { describe, expect, it } from "vitest";
import { validateSourceIds } from "@/lib/source-guard";

describe("validateSourceIds", () => {
  it("去重、过滤伪造 ID 并保留有效引用顺序", () => {
    expect(validateSourceIds(["S-H03-02", "made-up-999", "S-H03-01", "S-H03-02"], ["S-H03-01", "S-H03-02"]))
      .toEqual(["S-H03-02", "S-H03-01"]);
  });
  it("空白名单不放行任何来源", () => {
    expect(validateSourceIds(["made-up-999"], [])).toEqual([]);
    expect(validateSourceIds([], ["S-H03-01"])).toEqual([]);
  });
});
