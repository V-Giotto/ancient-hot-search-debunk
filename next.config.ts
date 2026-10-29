import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 避免 next dev 自动写入 AGENTS.md。
  agentRules: false,
};

export default nextConfig;
