import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const buildId = process.env.NODE_ENV === "development" ? "development" : randomUUID();

const nextConfig: NextConfig = {
  // 避免 next dev 自动写入 AGENTS.md。
  agentRules: false,
  generateBuildId: async () => buildId,
  // 与 .next/BUILD_ID 共用构建时的值，启动时重新加载配置不会改变已编译的 ID。
  env: { APP_BUILD_ID: buildId },
};

export default nextConfig;
