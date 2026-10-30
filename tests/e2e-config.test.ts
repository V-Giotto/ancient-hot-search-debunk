import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("E2E 截图目录", () => {
  it("使用环境变量覆盖，默认写入仓库内被忽略的 artifacts/e2e-review", () => {
    const source = readFileSync("scripts/e2e.mjs", "utf8");
    const gitignore = readFileSync(".gitignore", "utf8").split(/\r?\n/);

    expect(source).toContain('process.env.E2E_REVIEW_DIR || "artifacts/e2e-review"');
    expect(source).not.toContain("D:/agent_project/_shots");
    expect(gitignore).toContain("artifacts/");
  });
});
